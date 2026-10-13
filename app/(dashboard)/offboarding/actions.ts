'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireRole, VA_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { assertTerminationInScope } from '@/lib/offboarding-permissions'
import { MEETING_DECISION_LABELS } from '@/lib/offboarding'
import type { OffboardingMeetingDecision } from '@/src/generated/prisma/enums'

// End-of-contract meeting details and proof documents on an offboarding case
// (Business Ops meeting, 2026-10-12) — so anyone verifying a contract end
// later finds what was discussed, what was decided and the evidence in one
// place. Same role tier as the rest of day-to-day case work.

function text(formData: FormData, key: string): string | null {
  return ((formData.get(key) as string) ?? '').trim() || null
}

function parseUrl(raw: string | null): string | null {
  if (!raw) return null
  try {
    const u = new URL(raw)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

async function revalidateCase(terminationId: string) {
  const t = await prisma.termination.findUnique({ where: { id: terminationId }, select: { ticketId: true } })
  if (t?.ticketId) revalidatePath(`/tickets/${t.ticketId}`)
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

export async function saveOffboardingMeeting(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertTerminationInScope(actor, terminationId)

  const dateRaw = text(formData, 'meetingDate')
  const meetingDate = dateRaw ? new Date(`${dateRaw}T00:00:00.000Z`) : null
  if (meetingDate && Number.isNaN(meetingDate.getTime())) return { error: 'Invalid meeting date' }

  const recordingRaw = text(formData, 'meetingRecordingUrl')
  const meetingRecordingUrl = parseUrl(recordingRaw)
  if (recordingRaw && !meetingRecordingUrl) return { error: 'Recording link must be a full http(s) link' }

  const decisionRaw = text(formData, 'meetingDecision')
  if (decisionRaw && !(decisionRaw in MEETING_DECISION_LABELS)) return { error: 'Invalid decision' }

  const before = await prisma.termination.findUnique({
    where: { id: terminationId },
    select: { meetingDate: true, meetingDecision: true },
  })
  if (!before) return { error: 'Offboarding case not found' }

  const data = {
    meetingDate,
    meetingAttendees: text(formData, 'meetingAttendees'),
    meetingRecordingUrl,
    meetingNotes: text(formData, 'meetingNotes'),
    meetingDecision: decisionRaw as OffboardingMeetingDecision | null,
  }
  await prisma.termination.update({ where: { id: terminationId }, data })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Termination',
    entityId: terminationId,
    before: { meetingDate: before.meetingDate?.toISOString() ?? null, meetingDecision: before.meetingDecision },
    after: { ...data, meetingDate: meetingDate?.toISOString() ?? null },
  })

  await revalidateCase(terminationId)
  return { ok: true }
}

export async function addOffboardingDocument(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)
  await assertTerminationInScope(actor, terminationId)

  const label = text(formData, 'label')
  if (!label) return { error: 'Give the document a name' }
  const url = parseUrl(text(formData, 'url'))
  if (!url) return { error: 'Paste a full http(s) link to the document' }

  const doc = await prisma.terminationDocument.create({
    data: { terminationId, label, url, addedById: actor.id },
    select: { id: true },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'TerminationDocument',
    entityId: doc.id,
    after: { terminationId, label, url },
  })

  await revalidateCase(terminationId)
  return { ok: true }
}

export async function removeOffboardingDocument(documentId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const doc = await prisma.terminationDocument.findUnique({
    where: { id: documentId },
    select: { terminationId: true, label: true, url: true },
  })
  if (!doc) return { error: 'Document not found' }
  await assertTerminationInScope(actor, doc.terminationId)

  await prisma.terminationDocument.delete({ where: { id: documentId } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'TerminationDocument',
    entityId: documentId,
    before: doc,
  })

  await revalidateCase(doc.terminationId)
  return { ok: true }
}
