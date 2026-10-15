'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { notifyMany } from '@/lib/notifications'
import { getConcernAccess, concernPermissions, getDepartmentManagerIds } from '@/lib/va-concerns'
import { formatConcernNumber, ESCALATION_STATUS_OPTIONS } from '@/lib/va-concerns-fields'
import type { VAConcernEscalation, VAConcernStatus } from '@/src/generated/prisma/enums'

type Result = { ok: true; id?: string } | { error: string }

const STATUSES: VAConcernStatus[] = ['PENDING', 'UNDER_REVIEW', 'ESCALATED', 'RESOLVED']
const ESCALATIONS: VAConcernEscalation[] = ['MANAGER', 'HR', 'CLIENT_EXPERIENCE', 'BUSINESS_PROCESS', 'ACCOUNTING']

function text(formData: FormData, key: string, max = 5000): string | null {
  const v = ((formData.get(key) as string | null) ?? '').trim().slice(0, max)
  return v || null
}

function url(formData: FormData, key: string): string | null | 'invalid' {
  const v = text(formData, key, 2000)
  if (!v) return null
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:' ? v : 'invalid'
  } catch {
    return 'invalid'
  }
}

function date(formData: FormData, key: string): Date | null {
  const raw = text(formData, key, 20)
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

// The part of the row a Team Leader owns: the concern itself and their own
// action. Shared by create and update.
async function readConcernFields(formData: FormData, departmentId: string) {
  const category = text(formData, 'category', 200)
  if (!category) return { error: 'Choose a type of concern.' } as const

  const concernDate = date(formData, 'concernDate')
  if (!concernDate) return { error: 'Enter the date of the concern.' } as const

  const referenceUrl = url(formData, 'referenceUrl')
  const recordingUrl = url(formData, 'recordingUrl')
  if (referenceUrl === 'invalid' || recordingUrl === 'invalid') {
    return { error: 'Reference and recording must be full links starting with https://' } as const
  }

  // A client must belong to the concern's department; anything else is
  // dropped rather than trusted from the form.
  let clientId = text(formData, 'clientId', 100)
  if (clientId) {
    const ok = await prisma.client.count({ where: { id: clientId, departmentId } })
    if (!ok) clientId = null
  }

  return {
    data: {
      concernDate,
      category,
      concern: text(formData, 'concern', 300),
      description: text(formData, 'description'),
      suggestedMitigation: text(formData, 'suggestedMitigation'),
      clientId,
      clientName: clientId ? null : text(formData, 'clientName', 200),
      teamLeaderAction: text(formData, 'teamLeaderAction'),
      referenceUrl,
      recordingUrl,
    },
  } as const
}

function readStatus(formData: FormData) {
  const status = formData.get('status') as VAConcernStatus | null
  const escalatedTo = (formData.get('escalatedTo') as VAConcernEscalation | null) || null
  if (!status || !STATUSES.includes(status)) return { error: 'Choose a status.' } as const
  if (status === 'ESCALATED' && (!escalatedTo || !ESCALATIONS.includes(escalatedTo))) {
    return { error: 'Choose who the concern is escalated to.' } as const
  }
  return { status, escalatedTo: escalatedTo && ESCALATIONS.includes(escalatedTo) ? escalatedTo : null } as const
}

function revalidateConcerns() {
  revalidatePath('/va-concerns')
}

// Who hears about a concern: its department's managers when a Team Leader
// raises it or escalates it to them, HR when it's escalated to HR. Never the
// person who made the change.
async function notifyForConcern(params: {
  actorId: string
  actorName: string
  concernId: string
  number: number
  vaName: string
  departmentId: string
  event: 'raised' | 'escalated'
  escalatedTo: VAConcernEscalation | null
}) {
  let recipients: string[] = []
  if (params.event === 'raised' || params.escalatedTo === 'MANAGER') {
    recipients = await getDepartmentManagerIds(params.departmentId)
  } else if (params.escalatedTo === 'HR') {
    const hr = await prisma.user.findMany({ where: { systemRole: 'HR', isActive: true }, select: { id: true } })
    recipients = hr.map((u) => u.id)
  }
  recipients = recipients.filter((id) => id !== params.actorId)
  if (recipients.length === 0) return

  const no = formatConcernNumber(params.number)
  await notifyMany(
    recipients.map((recipientId) => ({
      recipientId,
      type: 'VA_CONCERN' as const,
      title: params.event === 'raised' ? `New VA concern ${no}` : `VA concern ${no} escalated to you`,
      message:
        params.event === 'raised'
          ? `${params.actorName} raised a concern about ${params.vaName}.`
          : `${params.actorName} escalated the concern about ${params.vaName}.`,
      entityType: 'VAConcern',
      entityId: params.concernId,
    }))
  )
}

export async function createConcern(formData: FormData): Promise<Result> {
  const actor = await requireAuth()
  const access = await getConcernAccess(actor)

  const vaProfileId = text(formData, 'vaProfileId', 100)
  const departmentId = text(formData, 'departmentId', 100)
  if (!vaProfileId || !departmentId) return { error: 'Choose the VA this concern is about.' }

  const va = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { userId: true, user: { select: { firstName: true, lastName: true } } },
  })
  if (!va) return { error: 'VA not found.' }
  const perms = concernPermissions(access, { departmentId, vaUserId: va.userId })
  if (!perms.canEditConcern) return { error: "You can only raise concerns about VAs on your team or in your department." }
  const inDepartment = await prisma.departmentMembership.count({
    where: { userId: va.userId, departmentId, endedAt: null },
  })
  if (!inDepartment) return { error: "That VA isn't in this department." }

  const fields = await readConcernFields(formData, departmentId)
  if ('error' in fields) return { error: fields.error as string }
  const statusInput = readStatus(formData)
  if ('error' in statusInput) return { error: statusInput.error as string }

  const concern = await prisma.vAConcern.create({
    data: {
      ...fields.data,
      departmentId,
      vaProfileId,
      status: statusInput.status,
      escalatedTo: statusInput.status === 'ESCALATED' ? statusInput.escalatedTo : null,
      escalationStatus: statusInput.status === 'ESCALATED' ? 'PENDING' : null,
      ...(perms.canEditManagerFields && { managerAction: text(formData, 'managerAction') }),
      resolvedAt: statusInput.status === 'RESOLVED' ? new Date() : null,
      reportedById: actor.id,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'VAConcern',
    entityId: concern.id,
    after: { vaProfileId, category: concern.category, status: concern.status },
    departmentId,
  })

  const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()
  const actorName = `${actor.firstName} ${actor.lastName}`.trim() || actor.email
  // A manager raising one in their own department doesn't need telling.
  if (!perms.canEditManagerFields) {
    await notifyForConcern({
      actorId: actor.id,
      actorName,
      concernId: concern.id,
      number: concern.number,
      vaName,
      departmentId,
      event: 'raised',
      escalatedTo: null,
    })
  }
  if (concern.status === 'ESCALATED' && concern.escalatedTo === 'HR') {
    await notifyForConcern({
      actorId: actor.id,
      actorName,
      concernId: concern.id,
      number: concern.number,
      vaName,
      departmentId,
      event: 'escalated',
      escalatedTo: 'HR',
    })
  }

  revalidateConcerns()
  return { ok: true, id: concern.id }
}

export async function updateConcern(concernId: string, formData: FormData): Promise<Result> {
  const actor = await requireAuth()
  const access = await getConcernAccess(actor)

  const existing = await prisma.vAConcern.findUnique({
    where: { id: concernId },
    include: { vaProfile: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } } },
  })
  if (!existing) return { error: 'Concern not found.' }
  const perms = concernPermissions(access, { departmentId: existing.departmentId, vaUserId: existing.vaProfile.userId })
  if (!perms.canEditConcern) return { error: "You don't have access to change this concern." }

  const fields = await readConcernFields(formData, existing.departmentId)
  if ('error' in fields) return { error: fields.error as string }
  const statusInput = readStatus(formData)
  if ('error' in statusInput) return { error: statusInput.error as string }

  const escalatedTo = statusInput.status === 'ESCALATED' ? statusInput.escalatedTo : existing.escalatedTo
  let escalationStatus = existing.escalationStatus

  const managerData: Record<string, unknown> = {}
  if (perms.canEditManagerFields) {
    const escalationReference = url(formData, 'escalationReference')
    if (escalationReference === 'invalid') return { error: 'The escalation reference must be a full link starting with https://' }
    const requested = formData.get('escalationStatus') as string | null
    if (requested !== null) {
      escalationStatus = (ESCALATION_STATUS_OPTIONS as readonly string[]).includes(requested)
        ? (requested as VAConcernStatus)
        : null
    }
    Object.assign(managerData, {
      managerAction: text(formData, 'managerAction'),
      hrAction: text(formData, 'hrAction'),
      clientExperienceAction: text(formData, 'clientExperienceAction'),
      businessProcessAction: text(formData, 'businessProcessAction'),
      accountingAction: text(formData, 'accountingAction'),
      escalationReference,
    })
  }
  // A concern sent to a new team starts over at Pending for that team.
  if (statusInput.status === 'ESCALATED' && (escalatedTo !== existing.escalatedTo || !escalationStatus)) {
    escalationStatus = 'PENDING'
  }

  const updated = await prisma.vAConcern.update({
    where: { id: concernId },
    data: {
      ...fields.data,
      ...managerData,
      status: statusInput.status,
      escalatedTo,
      escalationStatus,
      resolvedAt:
        statusInput.status === 'RESOLVED' ? (existing.resolvedAt ?? new Date()) : null,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: existing.status !== updated.status ? 'STATUS_CHANGE' : 'UPDATE',
    entityType: 'VAConcern',
    entityId: concernId,
    before: { status: existing.status, escalatedTo: existing.escalatedTo, category: existing.category },
    after: { status: updated.status, escalatedTo: updated.escalatedTo, category: updated.category },
    departmentId: existing.departmentId,
  })

  const newlyEscalated =
    updated.status === 'ESCALATED' &&
    (existing.status !== 'ESCALATED' || existing.escalatedTo !== updated.escalatedTo)
  if (newlyEscalated) {
    await notifyForConcern({
      actorId: actor.id,
      actorName: `${actor.firstName} ${actor.lastName}`.trim() || actor.email,
      concernId,
      number: updated.number,
      vaName: `${existing.vaProfile.user.firstName} ${existing.vaProfile.user.lastName}`.trim(),
      departmentId: existing.departmentId,
      event: 'escalated',
      escalatedTo: updated.escalatedTo,
    })
  }

  revalidateConcerns()
  return { ok: true }
}

export async function deleteConcern(concernId: string): Promise<Result> {
  const actor = await requireAuth()
  const access = await getConcernAccess(actor)
  if (!access.canDelete) return { error: 'Only admins can delete concerns.' }

  const existing = await prisma.vAConcern.findUnique({ where: { id: concernId } })
  if (!existing) return { error: 'Concern not found.' }

  await prisma.vAConcern.delete({ where: { id: concernId } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'VAConcern',
    entityId: concernId,
    before: { number: existing.number, vaProfileId: existing.vaProfileId, category: existing.category, status: existing.status },
    departmentId: existing.departmentId,
  })

  revalidateConcerns()
  return { ok: true }
}
