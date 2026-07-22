'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { isServiceLevel, DepartmentValidationError } from '@/lib/departments'
import { requireRole, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { getIntakeFieldsForDepartment, type IntakeFieldKey } from '@/lib/clients/intake-fields'
import { CLIENT_STATUS_LABEL } from '@/lib/clients/display'

export async function createClient(formData: FormData) {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const notes = (formData.get('notes') as string) || null
  const managerId = (formData.get('managerId') as string) || null
  const departmentId = (formData.get('departmentId') as string) || null
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

  if (departmentId) {
    const ok = await isServiceLevel(departmentId)
    if (!ok) {
      throw new DepartmentValidationError([{ field: 'departmentId', message: 'Clients can only be assigned to Service-level departments' }])
    }
  }

  const client = await prisma.client.create({
    data: {
      name,
      contactName,
      contactEmail,
      platform: platform as any,
      industry,
      notes,
      managerId,
      departmentId: departmentId || null,
      requiredSkills: skills,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Client',
    entityId: client.id,
    after: { name, contactName, contactEmail, platform, industry, managerId, departmentId },
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  redirect(`/clients/${client.id}`)
}

export async function updateClient(id: string, formData: FormData) {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const contactPhone = (formData.get('contactPhone') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const timezone = (formData.get('timezone') as string) || null
  const website = (formData.get('website') as string) || null
  const notes = (formData.get('notes') as string) || null
  const isActive = formData.get('isActive') === 'on'
  const onHold = formData.get('onHold') === 'on'
  const statusRaw = formData.get('status') as string | null
  const status = statusRaw && statusRaw in CLIENT_STATUS_LABEL ? statusRaw : undefined
  const managerId = (formData.get('managerId') as string) || null
  const departmentId = (formData.get('departmentId') as string) || null
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

  if (departmentId) {
    const ok = await isServiceLevel(departmentId)
    if (!ok) {
      throw new DepartmentValidationError([{ field: 'departmentId', message: 'Clients can only be assigned to Service-level departments' }])
    }
  }

  const before = await prisma.client.findUnique({
    where: { id },
    select: { name: true, contactName: true, contactEmail: true, contactPhone: true, platform: true, industry: true, timezone: true, website: true, isActive: true, onHold: true, status: true, managerId: true, departmentId: true },
  })

  await prisma.client.update({
    where: { id },
    data: {
      name,
      contactName,
      contactEmail,
      contactPhone,
      platform: platform as any,
      industry,
      timezone,
      website,
      notes,
      isActive,
      onHold,
      ...(status ? { status: status as any } : {}),
      managerId,
      departmentId: departmentId || null,
      requiredSkills: skills,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Client',
    entityId: id,
    before: before ? { ...before } : undefined,
    after: { name, contactName, contactEmail, contactPhone, platform, industry, timezone, website, isActive, onHold, status, managerId, departmentId },
  })

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/admin/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
}

// Kept separate from updateClient so a table row's name can be edited
// inline without opening the full edit form — mirrors renameTeam's pattern.
export async function renameClient(id: string, name: string) {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Client name is required')

  const before = await prisma.client.findUnique({ where: { id }, select: { name: true } })
  if (!before) throw new Error('Client not found')
  if (trimmed === before.name) return

  await prisma.client.update({ where: { id }, data: { name: trimmed } })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Client',
    entityId: id,
    before: { name: before.name },
    after: { name: trimmed },
  })

  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  revalidatePath('/admin/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
}

// No caller currently redirects to /clients after deleting — the admin
// table calls this directly and refreshes itself, so this intentionally
// doesn't redirect (unlike createClient, which still lands on the new
// client's detail page from the standalone /clients/new form).
export async function deleteClient(id: string) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN')

  const before = await prisma.client.findUnique({ where: { id }, select: { name: true } })

  await prisma.client.delete({ where: { id } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'Client',
    entityId: id,
    before: before ? { ...before } : undefined,
  })

  revalidatePath('/clients')
  revalidatePath('/admin/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
}

// A CSV import is always scoped to one department at a time (the admin
// picks it in the modal before uploading) — the sheet's own "which
// department" column, if any, is not what decides the FK or which intake
// fields apply, since a single sheet may not even carry that column.
export type ClientCsvRow = {
  name: string
  platform?: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  industry?: string
  timezone?: string
  website?: string
  managerEmail?: string
  status?: string
  onHold?: string
  requiredSkills?: string
  notes?: string
  onboardingFolderUrl?: string
} & Partial<Record<IntakeFieldKey, string>>

export type ClientCsvImportResult = {
  created: number
  updated: number
  skipped: { row: number; reason: string }[]
}

const CSV_PLATFORM_VALUES = ['AMAZON', 'WALMART', 'TIKTOK_SHOP', 'SHOPIFY', 'MULTI']
// Keyword fallback for platform text a department's own sheet might use that
// isn't the literal enum value (e.g. "Amazon FBA", "Amazon US", "TikTok").
// Checked in order; first match wins.
const PLATFORM_KEYWORDS: [RegExp, string][] = [
  [/walmart/i, 'WALMART'],
  [/tiktok/i, 'TIKTOK_SHOP'],
  [/shopify/i, 'SHOPIFY'],
  [/amazon/i, 'AMAZON'],
  [/multi/i, 'MULTI'],
]

const CSV_STATUS_VALUES = ['ACTIVE', 'PENDING', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED', 'BLACKLISTED', 'UNIDENTIFIED']

// "Paused"/"EOC" aren't GeneralStatus values — Paused is onHold=true layered
// on top of whatever status a client already has, and EOC maps onto the
// existing PROJECT_ENDED value. These aliases let a CSV (or a human) use
// common vocabulary variants across different departments' sheets, not just
// the literal enum spelling or one department's specific wording.
const STATUS_ALIASES: Record<string, { status?: string; onHold?: boolean }> = {
  ACTIVE: { status: 'ACTIVE', onHold: false },
  LIVE: { status: 'ACTIVE', onHold: false },
  ONGOING: { status: 'ACTIVE', onHold: false },
  RUNNING: { status: 'ACTIVE', onHold: false },
  PENDING: { status: 'PENDING' },
  PAUSED: { onHold: true },
  ON_HOLD: { onHold: true },
  HOLD: { onHold: true },
  EOC: { status: 'PROJECT_ENDED' },
  END_OF_CONTRACT: { status: 'PROJECT_ENDED' },
  COMPLETED: { status: 'PROJECT_ENDED' },
  ENDED: { status: 'PROJECT_ENDED' },
  CLOSED: { status: 'PROJECT_ENDED' },
  DONE: { status: 'PROJECT_ENDED' },
  CANCELLED: { status: 'CANCELLED' },
  CANCELED: { status: 'CANCELLED' },
  TERMINATED: { status: 'CANCELLED' },
}

// A department's own vocabulary for "platform" or "status" won't always
// match our enum spelling exactly, and different departments' sheets won't
// share the same conventions — treating an unmatched value as fatal would
// mean the whole client row (name, contact info, everything) gets dropped
// just because one column used unfamiliar wording. Leave the field unset
// instead so the rest of the row still imports; nothing else depends on it.
function normalizeStatusCell(value: string | undefined): { status?: string; onHold?: boolean } {
  const trimmed = (value || '').trim()
  if (!trimmed) return {}
  const normalized = trimmed.toUpperCase().replace(/[\s-]+/g, '_')
  const alias = STATUS_ALIASES[normalized]
  if (alias) return alias
  if (CSV_STATUS_VALUES.includes(normalized)) return { status: normalized }
  return {}
}

function normalizeBooleanCell(value: string | undefined): boolean | undefined {
  const trimmed = (value || '').trim().toLowerCase()
  if (!trimmed) return undefined
  return ['true', 'yes', 'y', '1'].includes(trimmed)
}

const CSV_IMPORT_BATCH_SIZE = 20

export async function bulkImportClients(departmentId: string, rowsInput: ClientCsvRow[]): Promise<ClientCsvImportResult> {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const department = await prisma.department.findUnique({
    where: { id: departmentId },
    select: { id: true, name: true, shortName: true, acronym: true, level: true },
  })
  if (!department) throw new Error('Department not found')
  if (department.level !== 'SERVICE') {
    throw new DepartmentValidationError([{ field: 'departmentId', message: 'Clients can only be assigned to Service-level departments' }])
  }

  const intakeFieldKeys = getIntakeFieldsForDepartment(department)

  const managers = await prisma.user.findMany({ select: { id: true, email: true } })
  const managerIdByEmail = new Map(managers.map((m) => [m.email.toLowerCase(), m.id]))

  // Matched by (name, department) so re-importing the same sheet updates
  // existing rows instead of duplicating them.
  const existingClients = await prisma.client.findMany({
    where: { departmentId },
    select: { id: true, name: true },
  })
  const existingIdByName = new Map(existingClients.map((c) => [c.name.trim().toLowerCase(), c.id]))

  const result: ClientCsvImportResult = { created: 0, updated: 0, skipped: [] }

  type PreparedCreate = { rowNum: number; data: Record<string, unknown> }
  type PreparedUpdate = { rowNum: number; id: string; data: Record<string, unknown> }
  const toCreate: PreparedCreate[] = []
  const toUpdate: PreparedUpdate[] = []
  const pendingCreateIndexByName = new Map<string, number>()

  rowsInput.forEach((row, i) => {
    const rowNum = i + 2 // header is row 1
    const name = (row.name || '').trim()
    if (!name) {
      result.skipped.push({ row: rowNum, reason: 'Missing name' })
      return
    }

    const platformRaw = (row.platform || '').trim()
    const platformCell = platformRaw.toUpperCase().replace(/[\s-]+/g, '_')
    const platform = CSV_PLATFORM_VALUES.includes(platformCell)
      ? platformCell
      : PLATFORM_KEYWORDS.find(([re]) => re.test(platformRaw))?.[1]

    const { status, onHold: statusOnHold } = normalizeStatusCell(row.status)
    const explicitOnHold = normalizeBooleanCell(row.onHold)
    const onHold = explicitOnHold ?? statusOnHold

    const managerId = row.managerEmail && row.managerEmail.trim()
      ? managerIdByEmail.get(row.managerEmail.trim().toLowerCase())
      : undefined

    const intakeDetails: Partial<Record<IntakeFieldKey, string>> = {}
    for (const key of intakeFieldKeys) {
      const value = row[key]
      if (value && value.trim()) intakeDetails[key] = value.trim()
    }

    const skills = (row.requiredSkills || '').split(';').map((s) => s.trim()).filter(Boolean)

    const data: Record<string, unknown> = {
      name,
      departmentId,
      ...(platform ? { platform } : {}),
      ...(row.contactName?.trim() ? { contactName: row.contactName.trim() } : {}),
      ...(row.contactEmail?.trim() ? { contactEmail: row.contactEmail.trim() } : {}),
      ...(row.contactPhone?.trim() ? { contactPhone: row.contactPhone.trim() } : {}),
      ...(row.industry?.trim() ? { industry: row.industry.trim() } : {}),
      ...(row.timezone?.trim() ? { timezone: row.timezone.trim() } : {}),
      ...(row.website?.trim() ? { website: row.website.trim() } : {}),
      ...(managerId ? { managerId } : {}),
      ...(status ? { status } : {}),
      ...(onHold !== undefined ? { onHold } : {}),
      ...(skills.length > 0 ? { requiredSkills: skills } : {}),
      ...(row.notes?.trim() ? { notes: row.notes.trim() } : {}),
      ...(row.onboardingFolderUrl?.trim() ? { onboardingFolderUrl: row.onboardingFolderUrl.trim() } : {}),
      ...(Object.keys(intakeDetails).length > 0 ? { intakeDetails } : {}),
    }

    const nameKey = name.toLowerCase()
    const existingId = existingIdByName.get(nameKey)
    if (existingId) {
      toUpdate.push({ rowNum, id: existingId, data })
      return
    }

    const pendingIdx = pendingCreateIndexByName.get(nameKey)
    if (pendingIdx !== undefined) {
      // Same client appears more than once in this file — merge onto the
      // pending create instead of creating a second row for it.
      toCreate[pendingIdx].data = { ...toCreate[pendingIdx].data, ...data }
      return
    }
    pendingCreateIndexByName.set(nameKey, toCreate.length)
    toCreate.push({ rowNum, data: { ...data, platform: data.platform ?? 'MULTI' } })
  })

  for (let i = 0; i < toCreate.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batch = toCreate.slice(i, i + CSV_IMPORT_BATCH_SIZE)
    for (const item of batch) {
      try {
        const client = await prisma.client.create({ data: item.data as any })
        result.created++
        await logAudit({ actorId: actor.id, action: 'CREATE', entityType: 'Client', entityId: client.id, after: item.data })
      } catch (e) {
        result.skipped.push({ row: item.rowNum, reason: e instanceof Error ? e.message : 'Create failed' })
      }
    }
  }

  for (let i = 0; i < toUpdate.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + CSV_IMPORT_BATCH_SIZE)
    for (const item of batch) {
      try {
        await prisma.client.update({ where: { id: item.id }, data: item.data as any })
        result.updated++
        await logAudit({ actorId: actor.id, action: 'UPDATE', entityType: 'Client', entityId: item.id, after: item.data })
      } catch (e) {
        result.skipped.push({ row: item.rowNum, reason: e instanceof Error ? e.message : 'Update failed' })
      }
    }
  }

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')

  return result
}