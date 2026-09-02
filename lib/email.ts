import { Resend } from 'resend'

// Best-effort transactional email, same "never block the mutation" contract
// as logAudit()/notify() — a missing RESEND_API_KEY (e.g. local dev) or a
// send failure is logged and swallowed, not thrown.
let _resend: Resend | null | undefined

function getResend(): Resend | null {
  if (_resend !== undefined) return _resend
  const apiKey = process.env.RESEND_API_KEY
  _resend = apiKey ? new Resend(apiKey) : null
  return _resend
}

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string | string[]
  subject: string
  html: string
}): Promise<boolean> {
  const resend = getResend()
  if (!resend) {
    console.warn('[Email] RESEND_API_KEY not set — skipping send:', subject)
    return false
  }

  const from = process.env.EMAIL_FROM || 'notifications@vaaphilippines.com'

  try {
    const { error } = await resend.emails.send({ from, to, subject, html })
    if (error) {
      console.error('[Email] Resend rejected the send:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('[Email] Failed to send:', error)
    return false
  }
}

function wrapper(bodyHtml: string): string {
  return `<div style="font-family:sans-serif;font-size:14px;color:#1a1a1a;line-height:1.5">${bodyHtml}<p style="margin-top:24px;color:#888;font-size:12px">VAA Philippines &middot; Staff Leave Management</p></div>`
}

export function leaveApprovalNeededEmail(params: {
  approverName: string
  requesterName: string
  leaveType: string
  startDate: string
  endDate: string
  totalDays: string
  reason: string | null
  reviewUrl: string
}): { subject: string; html: string } {
  return {
    subject: `Leave approval needed: ${params.requesterName}`,
    html: wrapper(`
      <p>Hi ${params.approverName},</p>
      <p><strong>${params.requesterName}</strong> has requested ${params.leaveType.toLowerCase()} leave and needs your approval.</p>
      <ul>
        <li><strong>Dates:</strong> ${params.startDate} – ${params.endDate} (${params.totalDays} working day${params.totalDays === '1' ? '' : 's'})</li>
        ${params.reason ? `<li><strong>Reason:</strong> ${params.reason}</li>` : ''}
      </ul>
      <p><a href="${params.reviewUrl}" style="color:#2563eb">Review this request</a></p>
    `),
  }
}

export function leaveRequestDecidedEmail(params: {
  requesterName: string
  status: 'APPROVED' | 'REJECTED'
  leaveType: string
  startDate: string
  endDate: string
  decidedByName: string
  note: string | null
  viewUrl: string
}): { subject: string; html: string } {
  const verb = params.status === 'APPROVED' ? 'approved' : 'rejected'
  return {
    subject: `Your leave request was ${verb}`,
    html: wrapper(`
      <p>Hi ${params.requesterName},</p>
      <p>Your ${params.leaveType.toLowerCase()} leave request for ${params.startDate} – ${params.endDate} has been <strong>${verb}</strong> by ${params.decidedByName}.</p>
      ${params.note ? `<p><strong>Note:</strong> ${params.note}</p>` : ''}
      <p><a href="${params.viewUrl}" style="color:#2563eb">View your leave requests</a></p>
    `),
  }
}
