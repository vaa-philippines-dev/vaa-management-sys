// Labels and date parsing for assignment status changes — no Prisma import,
// so the client status dialog can use them too (lib/assignment-status.ts
// holds the write path).

import type { AssignmentStatus, AssignmentStatusReason } from '@/src/generated/prisma/enums'

export const ASSIGNMENT_STATUS_REASONS = [
  'CLIENT_PAYMENT_FAILURE',
  'CLIENT_REQUEST',
  'VA_REQUEST',
  'OTHER',
] as const satisfies readonly AssignmentStatusReason[]

export const ASSIGNMENT_STATUS_REASON_LABELS: Record<AssignmentStatusReason, string> = {
  CLIENT_PAYMENT_FAILURE: 'Client payment failure',
  CLIENT_REQUEST: 'Client request',
  VA_REQUEST: 'VA request',
  OTHER: 'Other',
}

export const ASSIGNMENT_STATUS_LABELS: Record<AssignmentStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ON_HOLD: 'On hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

// A YYYY-MM-DD from a date input -> UTC midnight (the convention every
// status/effectivity date here uses). Rejects anything after today; "today"
// allows one day of slack because Manila (UTC+8) is a calendar day ahead of
// UTC every morning until 8AM.
export function parseStatusEffectiveDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const d = new Date(`${value}T00:00:00.000Z`)
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) return null
  const latest = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`)
  latest.setUTCDate(latest.getUTCDate() + 1)
  return d > latest ? null : d
}
