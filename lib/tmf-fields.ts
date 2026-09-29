import type { AvailabilityRow } from '@/lib/va-availability-fields'

// Row types and labels for the Team Monitoring File (/tmf). No Prisma import,
// so the client board can use it — the queries live in lib/tmf.ts (same split
// as lib/va-availability-fields.ts vs lib/va-availability.ts).
//
// The TMF is the Team Leader's counterpart to the department's DMF: the same
// VAs, but only one team's, seen from the person who works with them daily.
// Where the DMF is the department's ledger (every VA, every client, staffing
// decisions), the TMF is a roster to keep current — the TL's own read on
// each member's availability, their upcoming client check-ins, and who's out.

export type TmfTeamOption = {
  id: string
  name: string
  departmentId: string
  departmentName: string
  // Leaders (and admins/HR) write the TMF block; a Dept/Ops Manager can read
  // it for oversight but never edit it — the DMF is theirs to edit.
  canEdit: boolean
}

export type TmfCheckInRow = {
  id: string
  assignmentId: string
  vaName: string
  vaProfileId: string
  clientName: string
  milestone: string
  dueDate: string
  overdue: boolean
}

export type TmfEngagementRow = {
  assignmentId: string
  vaName: string
  vaProfileId: string
  clientName: string
  hours: number
  startDate: string
  checksDone: number
  checksTotal: number
}

export type TmfLeaveRow = {
  id: string
  vaName: string
  leaveType: string
  status: string
  startDate: string
  endDate: string
  onLeaveToday: boolean
}

export type TmfSummary = {
  members: number
  engagements: number
  bookedHours: number
  freeHours: number
  checkInsOverdue: number
  checkInsDueSoon: number
  tmfNeedsReview: number
  mismatches: number
  onLeaveToday: number
}

export type TmfData = {
  team: TmfTeamOption & { leaderNames: string[] }
  availability: AvailabilityRow[]
  // Team members with no active membership in the team's own department —
  // they can't have a TMF row there, so they're called out rather than
  // silently dropped.
  outsideDepartment: string[]
  checkIns: TmfCheckInRow[]
  engagements: TmfEngagementRow[]
  leave: TmfLeaveRow[]
  summary: TmfSummary
}

// How far ahead the check-in list looks. Two weeks covers the D4/W1/W2
// cadence of a new engagement without burying the list in Month-6s.
export const TMF_CHECKIN_LOOKAHEAD_DAYS = 14
export const TMF_LEAVE_LOOKAHEAD_DAYS = 30

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  VACATION: 'Vacation',
  SICK: 'Sick',
  EMERGENCY: 'Emergency',
  MATERNITY: 'Maternity',
  PATERNITY: 'Paternity',
  UNPAID: 'Unpaid',
  BEREAVEMENT: 'Bereavement',
}
