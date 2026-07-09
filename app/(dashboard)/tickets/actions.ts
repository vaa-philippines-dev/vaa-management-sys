'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireAuth, TICKET_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { draftTicketFromReport } from '@/lib/ai/ticket-draft'

async function nextTicketNumber(): Promise<string> {
  const count = await prisma.ticket.count()
  return `TCK-${String(count + 1).padStart(5, '0')}`
}

export async function createTicket(formData: FormData) {
  const user = await requireAuth()

  const title = (formData.get('title') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const category = formData.get('category') as string
  const priority = (formData.get('priority') as string) || 'MEDIUM'
  const source = (formData.get('source') as string) || 'INTERNAL'
  const departmentId = (formData.get('departmentId') as string) || null
  const clientId = (formData.get('clientId') as string) || null

  if (!title || !category) throw new Error('Title and category are required')

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: await nextTicketNumber(),
      title,
      description,
      category: category as any,
      priority: priority as any,
      source: source as any,
      createdBy: user.id,
      departmentId,
      clientId,
    },
  })

  await logAudit({
    actorId: user.id,
    action: 'CREATE',
    entityType: 'Ticket',
    entityId: ticket.id,
    after: { title, category, priority, source },
    departmentId,
  })

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  redirect(`/tickets/${ticket.id}`)
}

/**
 * AI-assisted path: a VA uploads a screenshot (+ optional note) instead of
 * writing a technical description themselves. Gemini drafts title/description/
 * category/priority, which are submitted as the ticket directly.
 */
export async function createTicketFromScreenshot(formData: FormData) {
  const user = await requireAuth()

  const screenshot = formData.get('screenshot') as File | null
  const vaNote = (formData.get('vaNote') as string) || undefined
  const departmentId = (formData.get('departmentId') as string) || null
  const clientId = (formData.get('clientId') as string) || null

  if (!screenshot || screenshot.size === 0) throw new Error('Screenshot is required')

  const arrayBuffer = await screenshot.arrayBuffer()
  const screenshotBase64 = Buffer.from(arrayBuffer).toString('base64')

  const draft = await draftTicketFromReport({
    screenshotBase64,
    screenshotMimeType: screenshot.type || 'image/png',
    vaNote,
  })

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: await nextTicketNumber(),
      title: draft.title,
      description: draft.description,
      category: draft.category,
      priority: draft.priority,
      source: 'INTERNAL',
      createdBy: user.id,
      departmentId,
      clientId,
    },
  })

  await logAudit({
    actorId: user.id,
    action: 'CREATE',
    entityType: 'Ticket',
    entityId: ticket.id,
    after: { title: draft.title, category: draft.category, priority: draft.priority },
    metadata: { aiAssisted: true, vaNote: vaNote ?? null },
    departmentId,
  })

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  redirect(`/tickets/${ticket.id}`)
}

export async function updateTicketStatus(id: string, status: string) {
  const user = await requireAuth()
  if (!TICKET_MUTATOR_ROLES.includes(user.systemRole)) throw new Error('Forbidden')

  const before = await prisma.ticket.findUnique({ where: { id }, select: { status: true, departmentId: true } })
  if (!before) throw new Error('Ticket not found')

  await prisma.ticket.update({
    where: { id },
    data: {
      status: status as any,
      resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? new Date() : null,
    },
  })

  await logAudit({
    actorId: user.id,
    action: 'STATUS_CHANGE',
    entityType: 'Ticket',
    entityId: id,
    before: { status: before.status },
    after: { status },
    departmentId: before.departmentId,
  })

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath(`/tickets/${id}`)
}

export async function assignTicket(id: string, assignedTo: string | null) {
  const user = await requireAuth()
  if (!TICKET_MUTATOR_ROLES.includes(user.systemRole)) throw new Error('Forbidden')

  const before = await prisma.ticket.findUnique({ where: { id }, select: { assignedTo: true, departmentId: true } })
  if (!before) throw new Error('Ticket not found')

  await prisma.ticket.update({ where: { id }, data: { assignedTo } })

  await logAudit({
    actorId: user.id,
    action: 'UPDATE',
    entityType: 'Ticket',
    entityId: id,
    before: { assignedTo: before.assignedTo },
    after: { assignedTo },
    departmentId: before.departmentId,
  })

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath(`/tickets/${id}`)
}

export async function deleteTicket(id: string) {
  const user = await requireAuth()
  if (!TICKET_MUTATOR_ROLES.includes(user.systemRole)) throw new Error('Forbidden')

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    select: { ticketNumber: true, title: true, status: true, departmentId: true },
  })
  if (!ticket) throw new Error('Ticket not found')

  await prisma.ticket.delete({ where: { id } })

  await logAudit({
    actorId: user.id,
    action: 'DELETE',
    entityType: 'Ticket',
    entityId: id,
    before: { ticketNumber: ticket.ticketNumber, title: ticket.title, status: ticket.status },
    departmentId: ticket.departmentId,
  })

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  redirect('/tickets')
}

export async function addTicketMessage(formData: FormData) {
  const user = await requireAuth()

  const ticketId = formData.get('ticketId') as string
  const message = (formData.get('message') as string)?.trim()
  const isInternalNote = formData.get('isInternalNote') === 'on' && TICKET_MUTATOR_ROLES.includes(user.systemRole)

  if (!ticketId || !message) throw new Error('Message is required')

  await prisma.ticketConversation.create({
    data: {
      ticketId,
      userId: user.id,
      message,
      isInternalNote,
    },
  })

  revalidatePath(`/tickets/${ticketId}`)
}
