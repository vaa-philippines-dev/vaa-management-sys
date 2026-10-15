'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { getPublicFormActorId } from '@/lib/public-actor'
import { nextTerminationTicketNumber } from '@/lib/tickets'
import { logAudit } from '@/lib/audit'
import { notifyMany } from '@/lib/notifications'

// The login page's two help forms. Whoever fills these in has no account (or
// can't get into it), so there's no session to check: both are on the
// PUBLIC_TOKEN_ACTIONS allowlist in scripts/check-action-auth.ts. All they
// can do is open a ticket for the admins, who create or fix the account
// themselves from Admin Panel → Users — nothing here grants access.

type Result = { ok: true } | { error: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_FIELD = 2000

// Spam guards. A public form with no login can be hit by anyone, so cap how
// many tickets one email can open in a day, and how many the whole form can
// open in an hour, rather than letting a script fill the ticket queue.
const PER_EMAIL_PER_DAY = 3
const ALL_PER_HOUR = 40

function clean(value: FormDataEntryValue | null, max = 200): string {
  return ((value as string | null) ?? '').trim().slice(0, max)
}

async function checkLimits(actorId: string, email: string): Promise<string | null> {
  const now = Date.now()
  const [sameEmail, recent] = await Promise.all([
    prisma.ticket.count({
      where: {
        createdBy: actorId,
        createdAt: { gte: new Date(now - 24 * 3_600_000) },
        title: { contains: `<${email}>`, mode: 'insensitive' },
      },
    }),
    prisma.ticket.count({ where: { createdBy: actorId, createdAt: { gte: new Date(now - 3_600_000) } } }),
  ])
  if (sameEmail >= PER_EMAIL_PER_DAY) {
    return 'We already have your request. An admin will contact you at that email.'
  }
  if (recent >= ALL_PER_HOUR) return 'Too many requests right now. Please try again in an hour.'
  return null
}

async function openTicket(params: {
  title: string
  description: string
  category: 'GENERAL' | 'TECHNICAL'
  notifyTitle: string
  notifyMessage: string
  email: string
}): Promise<Result> {
  const actorId = await getPublicFormActorId()
  const limited = await checkLimits(actorId, params.email)
  if (limited) return { error: limited }

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber: await nextTerminationTicketNumber(),
      title: params.title,
      description: params.description,
      category: params.category,
      priority: 'MEDIUM',
      createdBy: actorId,
    },
  })

  await logAudit({
    actorId,
    action: 'CREATE',
    entityType: 'Ticket',
    entityId: ticket.id,
    after: { title: params.title, category: params.category },
    metadata: { viaForm: 'login-page' },
  })

  const admins = await prisma.user.findMany({
    where: { systemRole: { in: ['SUPER_ADMIN', 'SYSTEM_ADMIN'] }, isActive: true, isBot: false },
    select: { id: true },
  })
  await notifyMany(
    admins.map((a) => ({
      recipientId: a.id,
      type: 'SUPPORT_REQUEST' as const,
      title: params.notifyTitle,
      message: params.notifyMessage,
      entityType: 'Ticket',
      entityId: ticket.id,
    }))
  )

  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  return { ok: true }
}

export async function submitAccountRequest(formData: FormData): Promise<Result> {
  if (clean(formData.get('website'))) return { ok: true } // honeypot: only bots fill the hidden field

  const name = clean(formData.get('name'))
  const email = clean(formData.get('email')).toLowerCase()
  const department = clean(formData.get('department'))
  const userType = clean(formData.get('userType')) === 'VA' ? 'Virtual Assistant' : 'Internal Staff'
  const note = clean(formData.get('note'), MAX_FIELD)

  if (!name) return { error: 'Enter your full name.' }
  if (!EMAIL_RE.test(email)) return { error: 'Enter a valid email address.' }

  // Recorded for the admin rather than told to the requester, so the form
  // can't be used to find out which emails have accounts.
  const existing = await prisma.user.findUnique({ where: { email }, select: { isActive: true } })

  return openTicket({
    title: `Account request: ${name} <${email}>`,
    description: [
      `Name: ${name}`,
      `Email: ${email}`,
      `Department: ${department || 'Not given'}`,
      `Account type: ${userType}`,
      existing
        ? `Account check: this email already has ${existing.isActive ? 'an active' : 'a disabled'} account.`
        : 'Account check: no account uses this email yet.',
      note ? `\n${note}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    category: 'GENERAL',
    notifyTitle: 'New account request',
    notifyMessage: `${name} (${email}) asked for an account${department ? ` in ${department}` : ''}.`,
    email,
  })
}

export async function submitLoginSupportRequest(formData: FormData): Promise<Result> {
  if (clean(formData.get('website'))) return { ok: true }

  const name = clean(formData.get('name'))
  const email = clean(formData.get('email')).toLowerCase()
  const issues = formData
    .getAll('issues')
    .map((v) => clean(v))
    .filter(Boolean)
    .slice(0, 10)
  const details = clean(formData.get('details'), MAX_FIELD)

  if (!EMAIL_RE.test(email)) return { error: 'Enter the email we should reply to.' }
  if (issues.length === 0 && !details) return { error: 'Select an issue or add details.' }

  const account = await prisma.user.findUnique({ where: { email }, select: { isActive: true } })
  const accountNote = !account
    ? 'No account uses this email.'
    : account.isActive
      ? 'An active account uses this email.'
      : 'The account for this email is disabled.'

  return openTicket({
    title: `Login help: ${name || email} <${email}>`,
    description: [
      name ? `Name: ${name}` : null,
      `Email: ${email}`,
      `Account check: ${accountNote}`,
      issues.length > 0 ? `\nIssues:\n${issues.map((i) => `- ${i}`).join('\n')}` : null,
      details ? `\nDetails:\n${details}` : null,
    ]
      .filter(Boolean)
      .join('\n'),
    category: 'TECHNICAL',
    notifyTitle: 'Someone needs help logging in',
    notifyMessage: `${name || email} reported a login problem.`,
    email,
  })
}
