import type { KpiMilestone } from '@/src/generated/prisma/enums'

// Labels and row shapes for the DMF sheet's "Performance Monitoring" tab.
// No Prisma import, so the client board can use it — the queries live in
// lib/performance.ts. KPI milestone labels and due-date maths stay in
// lib/kpi-checks.ts, which already owns them.

export type FeedbackWindow = 'W2' | 'M6'

export const FEEDBACK_WINDOWS: FeedbackWindow[] = ['W2', 'M6']

// The sheet heads these blocks "2ND WEEK FEEDBACK" and "6TH MONTH FEEDBACK".
export const FEEDBACK_WINDOW_LABELS: Record<FeedbackWindow, string> = {
  W2: '2nd Week',
  M6: '6th Month',
}

export const RESPONSE_STATUS_LABELS: Record<string, string> = {
  NOT_SENT: 'Not sent',
  AWAITING_RESPONSE: 'Awaiting response',
  RESPONDED: 'Responded',
  NO_RESPONSE: 'No response',
  DECLINED: 'Declined',
}

export type FeedbackCell = {
  id: string | null
  window: FeedbackWindow
  requested: boolean
  emailSentAt: string | null
  responseStatus: string
  receivedAt: string | null
  feedback: string | null
  relayedToVa: boolean
  relayedAt: string | null
  // In scope, the client has answered, and the VA still hasn't been told —
  // the one state in this cycle that's actively waiting on the department.
  awaitingRelay: boolean
}

export type KpiCell = {
  id: string
  milestone: KpiMilestone
  dueDate: string
  completed: boolean
  overdue: boolean
}

export type PerformanceRow = {
  assignmentId: string
  vaProfileId: string
  vaName: string
  clientName: string
  departmentName: string | null
  teamName: string | null
  startDate: string
  endDate: string | null
  personInChargeName: string | null
  shadowTrainerName: string | null
  expertiseGroup: string | null

  kpi: KpiCell[]
  kpiDone: number
  kpiOverdue: number

  feedback: Record<FeedbackWindow, FeedbackCell>
}
