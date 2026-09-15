import type {
  PreparationStartStatus,
  PreparationStepStatus,
  PreparationClientStatus,
  PreparationVaType,
} from '@/src/generated/prisma/enums'

// Labels, field lists and the row shape for the DMF sheet's "VA Preparation"
// tab. Deliberately free of any Prisma import so the client board can import
// it — the queries themselves live in lib/va-preparation.ts, same split as
// lib/leave-roles.ts vs lib/leave.ts.

export const START_STATUS_LABELS: Record<PreparationStartStatus, string> = {
  NOT_YET_STARTED: 'Not Yet Started',
  STARTED_ON_TIME: 'Started On-Time',
  DELAYED: 'Delayed',
  CANCELLED: 'Cancelled',
}

export const VA_TYPE_LABELS: Record<PreparationVaType, string> = {
  NEW: 'New',
  ADDITIONAL: 'Additional',
  REPLACEMENT: 'Replacement',
}

export const STEP_STATUS_LABELS: Record<PreparationStepStatus, string> = {
  PENDING: 'Pending',
  SCHEDULED: 'Scheduled',
  DONE: 'Done',
  SKIPPED: 'Skipped',
}

export const CLIENT_STATUS_LABELS: Record<PreparationClientStatus, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  END_OF_WORK: 'End of Work',
}

// The sheet's nine TRUE/FALSE onboarding columns, in its own left-to-right
// order — the order managers read them in, so don't re-sort alphabetically.
export const CHECKLIST_FIELDS = [
  { key: 'announcementEmail', label: 'Announcement Email' },
  { key: 'clientBriefingCall', label: 'Client Briefing Call' },
  { key: 'csBriefing', label: 'CS Briefing' },
  { key: 'vaaBackground', label: 'VAA Background' },
  { key: 'emailSignature', label: 'Email Signature' },
  { key: 'groupChat', label: 'Group Chat' },
  { key: 'milestoneFolder', label: 'Milestone Folder' },
  { key: 'weeklyReport', label: 'Weekly Report' },
  { key: 'portfolio', label: 'Portfolio' },
] as const

export type ChecklistKey = (typeof CHECKLIST_FIELDS)[number]['key']

// The SCHEDULE block's four steps in pipeline order, each pairing a date
// column with its status column.
export const PIPELINE_STEPS = [
  { key: 'clientMeeting', label: 'Client Meeting', dateField: 'clientMeetingDate', statusField: 'clientMeetingStatus' },
  { key: 'preparationCall', label: 'Preparation Call', dateField: 'preparationCallDate', statusField: 'preparationCallStatus' },
  { key: 'mockInterview', label: 'Mock Interview', dateField: 'mockInterviewDate', statusField: 'mockInterviewStatus' },
  { key: 'vaConnect', label: 'VA Connect', dateField: 'vaConnectDate', statusField: 'vaConnectStatus' },
] as const

export type PreparationRow = {
  id: string
  assignmentId: string
  vaProfileId: string
  vaName: string
  clientName: string
  departmentName: string | null
  teamName: string | null

  startStatus: PreparationStartStatus
  targetStartDate: string | null
  actualStartDate: string | null
  vaType: PreparationVaType
  scheduleType: string | null
  scheduleDays: string | null
  expertiseGroup: string | null
  vaBuffers: string | null
  vaClientFileUrl: string | null
  accountDocUrl: string | null
  replacementForId: string | null
  replacementForName: string | null
  personInChargeId: string | null
  personInChargeName: string | null
  shadowTrainerId: string | null
  shadowTrainerName: string | null

  clientMeetingDate: string | null
  clientMeetingStatus: PreparationStepStatus
  preparationStartDate: string | null
  preparationEndDate: string | null
  preparationCallDate: string | null
  preparationCallStatus: PreparationStepStatus
  mockInterviewDate: string | null
  mockInterviewStatus: PreparationStepStatus
  vaConnectDate: string | null
  vaConnectStatus: PreparationStepStatus

  checklist: Record<ChecklistKey, boolean>
  checklistDone: number

  clientStatus: PreparationClientStatus
  effectivityDate: string | null
  statusReason: string | null
  replacementNote: string | null
  replacedById: string | null
  replacedByName: string | null

  // The sheet's data-quality rule: a PAUSED or END_OF_WORK row with no
  // EFFECTIVITY DATE is an incomplete record, not a finished one.
  missingEffectivityDate: boolean
}
