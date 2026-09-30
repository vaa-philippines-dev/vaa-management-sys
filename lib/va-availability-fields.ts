// Labels, thresholds and the row shape for the DMF sheet's "VA Availability"
// tab. No Prisma import, so the client board can import it — the queries live
// in lib/va-availability.ts (same split as lib/leave-roles.ts vs lib/leave.ts).

import type { Availability } from '@/src/generated/prisma/enums'

// Every Availability value in "Change Availability" dropdown order — the one
// list the DMF board, the TMF board and both write actions share, so a new
// status can't reach one dropdown and be rejected by another's validation.
export const AVAILABILITY_STATUSES = [
  'AVAILABLE',
  'PARTIALLY_ASSIGNED',
  'FULLY_ASSIGNED',
  'ON_LEAVE',
  'UNAVAILABLE',
  'ON_HOLD_BY_VA',
  'ON_HOLD_BY_VAA',
  'RECOMMENDED',
] as const satisfies readonly Availability[]

export const AVAILABILITY_STATUS_LABELS: Record<Availability, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially Assigned',
  FULLY_ASSIGNED: 'Full',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
  ON_HOLD_BY_VA: 'On hold by VA',
  ON_HOLD_BY_VAA: 'On hold by VAA',
  RECOMMENDED: 'Recommended',
}

export function isAvailability(value: string): value is Availability {
  return (AVAILABILITY_STATUSES as readonly string[]).includes(value)
}

// The sheet buckets a VA's week into full-time / part-time / minimum
// part-time. 35h matches the schema's own full-time default; 20h is the
// 5-day-week reading of the sheet's "<4hrs/day" label. These are the same
// two numbers DepartmentHeadcountCard uses — kept here so both surfaces
// can't drift apart.
export const FULL_TIME_HOURS = 35
export const PART_TIME_FLOOR_HOURS = 20

// How long an availability record is trusted before it's considered stale.
// The sheet does this with a DMF UPDATE STATUS DATE a month after DMF DATE
// CHANGED; when no review date has been set, this is the fallback window.
export const AVAILABILITY_REVIEW_DAYS = 30

export type AvailabilityAlert = 'NONE' | 'NEVER_UPDATED' | 'REVIEW_OVERDUE'

export const ALERT_LABELS: Record<AvailabilityAlert, string> = {
  NONE: '',
  NEVER_UPDATED: 'Never updated',
  REVIEW_OVERDUE: 'Review overdue',
}

// The sheet's CURRENT STATUS column, which describes what kind of week the
// person works rather than whether they're free right now.
export type WorkPattern = 'FULL_TIME_VA' | 'PART_TIME_VA' | 'FULL_TIME_ADMIN' | 'PART_TIME_ADMIN'

export const WORK_PATTERN_LABELS: Record<WorkPattern, string> = {
  FULL_TIME_VA: 'Full time VA',
  PART_TIME_VA: 'Part time VA',
  FULL_TIME_ADMIN: 'Full time Admin',
  PART_TIME_ADMIN: 'Part time Admin',
}

// One row is one VA *in one department* — a VA in both PPC and Amazon is two
// rows, each with its own DMF/TMF block (VADepartmentAvailability), so
// neither department's edits can leak into the other's view.
export type AvailabilityRow = {
  rowKey: string
  vaProfileId: string
  departmentId: string
  userId: string
  employeeId: string | null
  name: string
  position: string | null
  departmentName: string
  teamName: string | null

  // Hours. `current` and `available` are derived, never stored — see the
  // VAProfile comment in prisma/schema.prisma. `currentHours` and
  // `clientCount` are this department's clients only; `otherDepartmentHours`
  // is what the same VA is booked for elsewhere. Available hours subtract
  // both, since a person's week doesn't grow with each department they join.
  preferredHours: number | null
  currentHours: number
  otherDepartmentHours: number
  hybridHours: number | null
  availableHours: number
  clientCount: number

  workPattern: WorkPattern
  // This department's DMF CHANGE AVAILABILITY, falling back to the VA's
  // profile-wide status when the department has never set one.
  availabilityStatus: string
  contractType: string | null
  generalStatus: string
  employmentStatus: string | null

  isRecommended: boolean
  recommendedForClient: string | null
  recommendedUntil: string | null

  availabilityRemarks: string | null
  availabilityChangedAt: string | null
  availabilityReviewDueAt: string | null
  alert: AvailabilityAlert

  // TMF block — the VA's Team Leader's own record of the same thing.
  tmfAvailabilityStatus: string | null
  tmfRemarks: string | null
  tmfChangedAt: string | null
  tmfReviewDueAt: string | null
  tmfUpdatedByName: string | null
  tmfAlert: AvailabilityAlert
  // The sheet's reconciliation signal: the Team Leader and the department
  // disagree about whether this VA is free. Only raised once both have set one.
  tmfMismatch: boolean
}

// AVAILABLE WORK HOURS in the sheet = PREFERRED - CURRENT - HYBRID, floored
// at zero (a VA booked past their preferred hours reads 0 available, not a
// negative). Verified against live rows: 8/5/-  -> 3, 3/4/- -> 0, 8/4/4 -> 0.
export function computeAvailableHours(
  preferred: number | null,
  current: number,
  hybrid: number | null
): number {
  if (preferred == null) return 0
  return Math.max(0, preferred - current - (hybrid ?? 0))
}

export function computeWorkPattern(isVA: boolean, preferred: number | null): WorkPattern {
  const fullTime = (preferred ?? FULL_TIME_HOURS) >= FULL_TIME_HOURS
  if (isVA) return fullTime ? 'FULL_TIME_VA' : 'PART_TIME_VA'
  return fullTime ? 'FULL_TIME_ADMIN' : 'PART_TIME_ADMIN'
}

// Only VAs who are actually offering hours can go stale — a fully-assigned
// or inactive VA has nothing to re-confirm, so flagging them would just be
// noise on a dashboard nobody then trusts.
//
// `preferredHours == null` is the same idea one step earlier: a VA with no
// preferred hours on file has no availability record to review yet. Without
// this guard every VA who has never had hours entered alerts at once (2,000+
// on live data), which buries the handful that genuinely need attention.
// That's a data-entry gap, surfaced by the Preferred column reading "—", not
// a stale record.
export type AvailabilitySummary = {
  total: number
  available: number
  fullyAssigned: number
  onLeave: number
  totalAvailableHours: number
  needsReview: number
  recommended: number
}

// The page always fetches the whole scoped row set (no pagination here,
// unlike /vas), so the scorecards reduce over what's already in hand rather
// than issuing separate aggregate queries.
export function computeAvailabilitySummary(rows: AvailabilityRow[]): AvailabilitySummary {
  return rows.reduce(
    (acc, r) => {
      acc.total++
      if (r.availabilityStatus === 'AVAILABLE') acc.available++
      if (r.availabilityStatus === 'FULLY_ASSIGNED') acc.fullyAssigned++
      if (r.availabilityStatus === 'ON_LEAVE') acc.onLeave++
      acc.totalAvailableHours += r.availableHours
      if (r.alert !== 'NONE') acc.needsReview++
      if (r.isRecommended) acc.recommended++
      return acc
    },
    { total: 0, available: 0, fullyAssigned: 0, onLeave: 0, totalAvailableHours: 0, needsReview: 0, recommended: 0 }
  )
}

export function computeAlert(
  availabilityStatus: string,
  preferredHours: number | null,
  changedAt: Date | null,
  reviewDueAt: Date | null,
  now: Date = new Date()
): AvailabilityAlert {
  if (availabilityStatus !== 'AVAILABLE' && availabilityStatus !== 'PARTIALLY_ASSIGNED') return 'NONE'
  if (preferredHours == null) return 'NONE'
  if (!changedAt) return 'NEVER_UPDATED'

  const due = reviewDueAt ?? new Date(changedAt.getTime() + AVAILABILITY_REVIEW_DAYS * 86_400_000)
  return due < now ? 'REVIEW_OVERDUE' : 'NONE'
}
