import { prisma } from '@/lib/prisma'
import { fetchDmfTabRows, type RawDmfRow } from '@/lib/google/dmf-sheet'
import { parseDmfDate, parseDmfBool, parseDmfNumber, rowLabel } from '@/lib/sync/dmf-parse'
import { buildDmfIndexes, matchName, pickAssignment, normalizeName, type DmfIndexes } from '@/lib/sync/dmf-match'
import type {
  PreparationStartStatus,
  PreparationVaType,
  PreparationStepStatus,
  PreparationClientStatus,
  KpiMilestone,
  FeedbackWindow,
  ClientResponseStatus,
  ProjectStatus,
  ProjectPriority,
} from '@/src/generated/prisma/enums'

// One-time backfill from a Department Monitoring File spreadsheet into the
// tables VA Preparation / Performance Monitoring / VA Availability /
// Projects actually read. Not a recurring sync — per the plan, the app
// takes over as source of truth after this runs once per department.
//
// Every importer is dry-run by default (apply: false) and returns a full
// report rather than writing. Nothing here fabricates a match: an
// unresolved or ambiguous name is reported and skipped, never guessed.

export const DMF_SOURCE = 'dmf_sheet'

export type ImportIssue = { label: string; reason: string }

export type ImportSummary = {
  tab: string
  totalRows: number
  matched: number
  changed: number // rows that would be (or were) written
  unchanged: number // matched but nothing to update
  unmatched: ImportIssue[]
  ambiguous: ImportIssue[]
  warnings: ImportIssue[]
}

function emptySummary(tab: string): ImportSummary {
  return { tab, totalRows: 0, matched: 0, changed: 0, unchanged: 0, unmatched: [], ambiguous: [], warnings: [] }
}

// ── Shared: resolve a sheet row's Assignment ──────────────────────
//
// VA Preparation and Performance Monitoring share the same RECORD NO for
// the same engagement, so once one tab resolves a row to an Assignment, the
// mapping is cached in ExternalSyncMapping and the other tab reuses it
// instead of re-running name matching — cheaper, and immune to the two
// tabs' VA/client name spelling ever drifting apart.
async function resolveAssignment(
  recordNo: string,
  vaName: string,
  clientName: string,
  targetDate: Date | null,
  indexes: DmfIndexes,
  mappingCache: Map<string, string>,
  apply: boolean
): Promise<{ assignmentId: string | null; reason?: string }> {
  const cached = mappingCache.get(recordNo)
  if (cached) return { assignmentId: cached }

  const va = matchName(indexes.vaByName, vaName)
  if (va.ambiguous) return { assignmentId: null, reason: `VA name "${vaName}" matches more than one VA in this department` }
  if (!va.id) return { assignmentId: null, reason: `No VA in this department named "${vaName}"` }

  const client = matchName(indexes.clientByName, clientName)
  if (client.ambiguous) return { assignmentId: null, reason: `Client name "${clientName}" matches more than one client in this department` }
  if (!client.id) return { assignmentId: null, reason: `No client in this department named "${clientName}"` }

  const candidates = indexes.assignmentsByVaAndClient.get(`${va.id}:${client.id}`)
  const assignmentId = pickAssignment(candidates, targetDate)
  if (!assignmentId) {
    return {
      assignmentId: null,
      reason: candidates?.length
        ? `${candidates.length} assignments between this VA and client, and no start date to break the tie`
        : `No assignment on record between "${vaName}" and "${clientName}"`,
    }
  }

  if (apply) {
    await prisma.externalSyncMapping.upsert({
      where: { source_entityType_externalId: { source: DMF_SOURCE, entityType: 'ASSIGNMENT', externalId: recordNo } },
      create: { source: DMF_SOURCE, entityType: 'ASSIGNMENT', externalId: recordNo, internalId: assignmentId },
      update: { internalId: assignmentId },
    })
  }
  mappingCache.set(recordNo, assignmentId)
  return { assignmentId }
}

async function loadMappingCache(): Promise<Map<string, string>> {
  const rows = await prisma.externalSyncMapping.findMany({
    where: { source: DMF_SOURCE, entityType: 'ASSIGNMENT' },
    select: { externalId: true, internalId: true },
  })
  return new Map(rows.map((r) => [r.externalId, r.internalId]))
}

// ── VA Preparation ─────────────────────────────────────────────────

const START_STATUS_MAP: Record<string, PreparationStartStatus> = {
  'not yet started': 'NOT_YET_STARTED',
  'started on-time': 'STARTED_ON_TIME',
  delayed: 'DELAYED',
  cancelled: 'CANCELLED',
}
const VA_TYPE_MAP: Record<string, PreparationVaType> = {
  new: 'NEW',
  additional: 'ADDITIONAL',
  replacement: 'REPLACEMENT',
}
const STEP_STATUS_MAP: Record<string, PreparationStepStatus> = {
  done: 'DONE',
  skipped: 'SKIPPED',
  scheduled: 'SCHEDULED',
}
const CLIENT_STATUS_MAP: Record<string, PreparationClientStatus> = {
  active: 'ACTIVE',
  paused: 'PAUSED',
  'end of work': 'END_OF_WORK',
}

function mapEnum<T extends string>(
  map: Record<string, T>,
  raw: string,
  fallback: T,
  warnings: ImportIssue[],
  label: string,
  field: string
): T {
  const trimmed = raw.trim()
  if (!trimmed) return fallback
  const mapped = map[trimmed.toLowerCase()]
  if (mapped) return mapped
  warnings.push({ label, reason: `Unrecognized ${field} "${raw}" — defaulted to ${fallback}` })
  return fallback
}

function httpUrlOrNull(raw: string): string | null {
  const trimmed = raw.trim()
  return /^https?:\/\//i.test(trimmed) ? trimmed : null
}

export async function importVaPreparation(
  sheetId: string,
  departmentId: string,
  indexes: DmfIndexes,
  mappingCache: Map<string, string>,
  apply: boolean
): Promise<ImportSummary> {
  const summary = emptySummary('VA Preparation')
  const rows = await fetchDmfTabRows(sheetId, 'VA Preparation', 3)
  summary.totalRows = rows.length

  for (const row of rows) {
    const recordNo = row['RECORD NO']
    const label = rowLabel(row)
    if (!recordNo) {
      summary.warnings.push({ label, reason: 'No RECORD NO — row skipped' })
      continue
    }

    const targetDate = parseDmfDate(row['ACTUAL START DATE']) ?? parseDmfDate(row['TARGET START DATE'])
    const { assignmentId, reason } = await resolveAssignment(
      recordNo,
      row['VA NAME'],
      row['PRIMARY ACCOUNT'],
      targetDate,
      indexes,
      mappingCache,
      apply
    )
    if (!assignmentId) {
      summary.unmatched.push({ label: `RECORD ${recordNo} — ${label}`, reason: reason ?? 'unresolved' })
      continue
    }
    summary.matched++

    const replacementFor = matchName(indexes.vaByName, row['REPLACEMENT FOR'])
    const replacedBy = matchName(indexes.vaByName, row['REPLACED BY'])
    const personInCharge = matchName(indexes.staffByFullName, row['PERSON IN-CHARGE'])
    const shadowTrainer = matchName(indexes.staffByFullName, row['SHADOW TRAINER'])
    const personInChargeFallback = personInCharge.id ? personInCharge : matchName(indexes.staffByFirstName, row['PERSON IN-CHARGE'])
    const shadowTrainerFallback = shadowTrainer.id ? shadowTrainer : matchName(indexes.staffByFirstName, row['SHADOW TRAINER'])

    const data = {
      startStatus: mapEnum(START_STATUS_MAP, row['DEPARTMENT STATUS'], 'NOT_YET_STARTED' as PreparationStartStatus, summary.warnings, label, 'DEPARTMENT STATUS'),
      targetStartDate: parseDmfDate(row['TARGET START DATE']),
      vaType: mapEnum(VA_TYPE_MAP, row['VA TYPE'], 'NEW' as PreparationVaType, summary.warnings, label, 'VA TYPE'),
      scheduleType: row['SCHEDULE TYPE'] || null,
      scheduleDays: row['SCHEDULE DAYS'] || null,
      expertiseGroup: row['EXPERTISE GROUP'] || null,
      vaBuffers: row['VA BUFFERS'] || null,
      vaClientFileUrl: httpUrlOrNull(row['VA-CLIENT FILE LINK'] || ''),
      accountDocUrl: httpUrlOrNull(row['ACCOUNT DOC FILE'] || ''),
      replacementForId: replacementFor.id,
      replacedById: replacedBy.id,
      personInChargeId: personInChargeFallback.id,
      shadowTrainerId: shadowTrainerFallback.id,

      clientMeetingDate: parseDmfDate(row['CLIENT MEETING DATE']),
      clientMeetingStatus: mapEnum(STEP_STATUS_MAP, row['CLIENT MEETING STATUS'], 'PENDING' as PreparationStepStatus, summary.warnings, label, 'CLIENT MEETING STATUS'),
      preparationStartDate: parseDmfDate(row['PREPARATION START DATE']),
      preparationEndDate: parseDmfDate(row['PREPARATION END DATE']),
      preparationCallDate: parseDmfDate(row['PREPARATION CALL']),
      preparationCallStatus: mapEnum(STEP_STATUS_MAP, row['PREPARATION CALL STATUS'], 'PENDING' as PreparationStepStatus, summary.warnings, label, 'PREPARATION CALL STATUS'),
      mockInterviewDate: parseDmfDate(row['MOCK INTERVIEW']),
      mockInterviewStatus: mapEnum(STEP_STATUS_MAP, row['MOCK INTERVIEW STATUS'], 'PENDING' as PreparationStepStatus, summary.warnings, label, 'MOCK INTERVIEW STATUS'),
      vaConnectDate: parseDmfDate(row['VA CONNECT']),
      vaConnectStatus: mapEnum(STEP_STATUS_MAP, row['VA CONNECT STATUS'], 'PENDING' as PreparationStepStatus, summary.warnings, label, 'VA CONNECT STATUS'),

      announcementEmail: parseDmfBool(row['Announcement Email']),
      clientBriefingCall: parseDmfBool(row['Client Briefing Call']),
      csBriefing: parseDmfBool(row['CS Briefing']),
      vaaBackground: parseDmfBool(row['VAA Background']),
      emailSignature: parseDmfBool(row['Email Signature']),
      groupChat: parseDmfBool(row['Group Chat']),
      milestoneFolder: parseDmfBool(row['Milestone Folder']),
      weeklyReport: parseDmfBool(row['Weekly Report']),
      portfolio: parseDmfBool(row['Portfolio']),

      clientStatus: mapEnum(CLIENT_STATUS_MAP, row['VA STATUS WITH CLIENT'], 'ACTIVE' as PreparationClientStatus, summary.warnings, label, 'VA STATUS WITH CLIENT'),
      effectivityDate: parseDmfDate(row['EFFECTIVITY DATE']),
      statusReason: row['REASON'] || null,
      replacementNote: row['REPLACEMENT'] || null,
    }

    summary.changed++
    if (apply) {
      await prisma.assignmentPreparation.update({ where: { assignmentId }, data }).catch((e) => {
        summary.warnings.push({ label, reason: `Write failed: ${e.message}` })
      })
    }
  }

  return summary
}

// ── Performance Monitoring ─────────────────────────────────────────

// The sheet mislabels its M6 check column "KPI M4 CHECK" — confirmed
// against the live header row; there is no separate M4 milestone at all
// (the fixed set is D4/W1/W2/M1/M2/M3/M6), so this is read by the position
// it actually occupies, not the name printed on it.
const KPI_CHECK_COLUMNS: Record<KpiMilestone, string> = {
  D4: 'KPI D4 CHECK',
  W1: 'KPI W1 CHECK',
  W2: 'KPI W2 CHECK',
  M1: 'KPI M1 CHECK',
  M2: 'KPI M2 CHECK',
  M3: 'KPI M3 CHECK',
  M6: 'KPI M4 CHECK',
}

const RESPONSE_STATUS_MAP: Record<string, ClientResponseStatus> = {
  responded: 'RESPONDED',
  'no response': 'NO_RESPONSE',
  declined: 'DECLINED',
  sent: 'AWAITING_RESPONSE',
  pending: 'AWAITING_RESPONSE',
  awaiting: 'AWAITING_RESPONSE',
  'awaiting response': 'AWAITING_RESPONSE',
}

function inferResponseStatus(raw: string, feedback: string, receivedAt: Date | null, emailSentAt: Date | null): ClientResponseStatus {
  const trimmed = raw.trim().toLowerCase()
  if (trimmed && RESPONSE_STATUS_MAP[trimmed]) return RESPONSE_STATUS_MAP[trimmed]
  // The sheet's response-status column was blank on every sampled row, so a
  // status is inferred from what else is filled in rather than guessed from
  // free text alone.
  if (feedback || receivedAt) return 'RESPONDED'
  if (emailSentAt) return 'AWAITING_RESPONSE'
  return 'NOT_SENT'
}

async function importFeedbackWindow(
  assignmentId: string,
  window: FeedbackWindow,
  row: RawDmfRow,
  prefix: 'W2' | 'M6',
  label: string,
  summary: ImportSummary,
  apply: boolean
) {
  const emailSentAt = parseDmfDate(row[`${prefix} PERFORMANCE EMAIL SENT DATE`])
  const receivedAt = parseDmfDate(row[`${prefix} FEEDBACK RECEIVED DATE`])
  const feedback = row[`${prefix} FEEDBACK`] || null
  const relayedToVa = parseDmfBool(row[`${prefix} FEEDBACK TO VA`])
  const flagged = parseDmfBool(row[`${prefix} CLIENT FEEDBACK`])

  const requested = flagged || !!emailSentAt || !!receivedAt || !!feedback || relayedToVa
  if (!requested) return // nothing to import for this window on this row — matches the page's own "untouched cell" semantics

  const responseStatus = inferResponseStatus(row[`${prefix} CLIENT RESPONSE STATUS`] || '', feedback ?? '', receivedAt, emailSentAt)
  if (responseStatus === 'RESPONDED' && !feedback) {
    summary.warnings.push({ label, reason: `${prefix} marked responded but no feedback text was recorded` })
  }
  if (relayedToVa && responseStatus !== 'RESPONDED') {
    summary.warnings.push({ label, reason: `${prefix} marked relayed to VA without a recorded response — imported as-is` })
  }

  summary.changed++
  if (apply) {
    await prisma.assignmentClientFeedback
      .upsert({
        where: { assignmentId_window: { assignmentId, window } },
        create: { assignmentId, window, requested, emailSentAt, responseStatus, receivedAt, feedback, relayedToVa },
        update: { requested, emailSentAt, responseStatus, receivedAt, feedback, relayedToVa },
      })
      .catch((e) => summary.warnings.push({ label, reason: `${prefix} write failed: ${e.message}` }))
  }
}

export async function importPerformanceMonitoring(
  sheetId: string,
  departmentId: string,
  indexes: DmfIndexes,
  mappingCache: Map<string, string>,
  apply: boolean
): Promise<ImportSummary> {
  const summary = emptySummary('Performance Monitoring')
  const rows = await fetchDmfTabRows(sheetId, 'Performance Monitoring', 3)
  summary.totalRows = rows.length

  for (const row of rows) {
    const recordNo = row['RECORD NO']
    const label = rowLabel(row)
    if (!recordNo) {
      summary.warnings.push({ label, reason: 'No RECORD NO — row skipped' })
      continue
    }

    const targetDate = parseDmfDate(row['START DATE'])
    const { assignmentId, reason } = await resolveAssignment(
      recordNo,
      row['VA NAME'],
      row['PRIMARY ACCOUNT'],
      targetDate,
      indexes,
      mappingCache,
      apply
    )
    if (!assignmentId) {
      summary.unmatched.push({ label: `RECORD ${recordNo} — ${label}`, reason: reason ?? 'unresolved' })
      continue
    }
    summary.matched++

    // KPI due dates are NOT imported — lib/kpi-checks.ts already computes
    // them from Assignment.startDate with the sheet's own WORKDAY/EDATE
    // formulas, and the sheet's own due-date columns here ("Aug 20" with no
    // year) aren't even reliably parseable on their own. Only the completed
    // flag is imported, and only upward (false -> true), never downgrading a
    // check-in someone has since completed in-app.
    const checks = await prisma.assignmentKpiCheck.findMany({
      where: { assignmentId },
      select: { id: true, milestone: true, completed: true },
    })
    for (const check of checks) {
      const column = KPI_CHECK_COLUMNS[check.milestone]
      if (!parseDmfBool(row[column])) continue
      if (check.completed) continue // already done in-app; don't touch completedAt/completedById
      summary.changed++
      if (apply) {
        // completedAt/completedById are left null — the sheet records that a
        // check happened, not who did it or exactly when, and fabricating
        // either would misattribute a real audit trail.
        await prisma.assignmentKpiCheck
          .update({ where: { id: check.id }, data: { completed: true } })
          .catch((e) => summary.warnings.push({ label, reason: `KPI ${check.milestone} write failed: ${e.message}` }))
      }
    }

    await importFeedbackWindow(assignmentId, 'W2', row, 'W2', label, summary, apply)
    await importFeedbackWindow(assignmentId, 'M6', row, 'M6', label, summary, apply)
  }

  return summary
}

// ── VA Availability ─────────────────────────────────────────────────

export async function importVaAvailability(
  sheetId: string,
  departmentId: string,
  indexes: DmfIndexes,
  apply: boolean
): Promise<ImportSummary> {
  const summary = emptySummary('VA Availability')
  const rows = await fetchDmfTabRows(sheetId, 'VA Availability', 3)
  summary.totalRows = rows.length

  for (const row of rows) {
    const label = rowLabel(row) || row['VA NAME']
    const va = matchName(indexes.vaByName, row['VA NAME'])
    if (va.ambiguous) {
      summary.ambiguous.push({ label, reason: `VA name "${row['VA NAME']}" matches more than one VA in this department` })
      continue
    }
    if (!va.id) {
      summary.unmatched.push({ label, reason: `No VA in this department named "${row['VA NAME']}"` })
      continue
    }
    summary.matched++

    // availabilityStatus itself (Availability enum) is deliberately not
    // touched — the sheet's "AVAILABILITY STATUS"/"CURRENT STATUS" columns
    // don't map cleanly onto AVAILABLE/PARTIALLY_ASSIGNED/FULLY_ASSIGNED/
    // ON_LEAVE/UNAVAILABLE, and that field is already maintained elsewhere
    // in the app (the VA profile editor). Overwriting it from an unclear
    // heuristic risked silently clobbering a real, separately-maintained
    // signal for a marginal gain.
    const data = {
      preferredWorkHours: parseDmfNumber(row['PREFERRED WORK HOURS']),
      hybridHours: parseDmfNumber(row['HYBRID HOURS']),
      isRecommended: parseDmfBool(row['RECOMMENDED']),
      recommendedForClient: row['RECOMMENDED FOR'] || null,
      recommendedUntil: row['RECOMMENDED UNTIL'] || null,
      availabilityRemarks: row['DMF REMARKS'] || null,
      availabilityChangedAt: parseDmfDate(row['DMF DATE CHANGED']),
      availabilityReviewDueAt: parseDmfDate(row['DMF UPDATE STATUS DATE']),
    }

    summary.changed++
    if (apply) {
      await prisma.vAProfile.update({ where: { id: va.id }, data }).catch((e) => {
        summary.warnings.push({ label, reason: `Write failed: ${e.message}` })
      })
    }
  }

  return summary
}

// ── Projects/Proposals ───────────────────────────────────────────────

const PROJECT_STATUS_MAP: Record<string, ProjectStatus> = {
  'for review': 'FOR_REVIEW',
  'for approval': 'FOR_APPROVAL',
  approved: 'APPROVED',
  'in-progress': 'IN_PROGRESS',
  'in progress': 'IN_PROGRESS',
  completed: 'COMPLETED',
  'on hold': 'ON_HOLD',
  declined: 'DECLINED',
}
const PROJECT_PRIORITY_MAP: Record<string, ProjectPriority> = {
  normal: 'NORMAL',
  important: 'IMPORTANT',
  critical: 'CRITICAL',
}

export async function importProjects(sheetId: string, departmentId: string, apply: boolean): Promise<ImportSummary> {
  const summary = emptySummary('Projects/Proposals')
  // Column A's header cell is blank in the live sheet (confirmed), so its
  // proposed-date values are otherwise unreachable by header name.
  const rows = await fetchDmfTabRows(sheetId, 'Projects/Proposals', 4, { 0: 'DATE' })
  summary.totalRows = rows.length

  const existing = await prisma.project.findMany({
    where: { departmentId },
    select: { name: true, proposedDate: true },
  })
  const existingKeys = new Set(
    existing.map((p) => `${normalizeName(p.name)}:${p.proposedDate?.toISOString() ?? 'none'}`)
  )

  for (const row of rows) {
    const name = row['PROJECT NAME']
    if (!name) continue // section-divider / blank rows (e.g. a bare year marker)
    const label = name

    const proposedDate = parseDmfDate(row['DATE'])
    const key = `${normalizeName(name)}:${proposedDate?.toISOString() ?? 'none'}`
    if (existingKeys.has(key)) {
      summary.unchanged++
      continue
    }

    summary.matched++
    summary.changed++
    // PROPOSAL FILE in the sheet is rich-text hyperlink display text, not a
    // plain URL the Sheets values API exposes — only the label is imported;
    // proposalFileUrl is left for someone to fill in from the actual sheet.
    const data = {
      name,
      description: row['SHORT DESCRIPTION'] || null,
      status: mapEnum(PROJECT_STATUS_MAP, row['STATUS'], 'FOR_REVIEW' as ProjectStatus, summary.warnings, label, 'STATUS'),
      priority: mapEnum(PROJECT_PRIORITY_MAP, row['PRIORITY'], 'NORMAL' as ProjectPriority, summary.warnings, label, 'PRIORITY'),
      proposedDate,
      startDate: parseDmfDate(row['START DATE']),
      completedDate: parseDmfDate(row['DATE COMPLETED']),
      proposalFileName: row['PROPOSAL FILE'] || null,
      referenceNotes: row['REFERENCES'] || null,
      remarks: row['REMARKS'] || null,
      departmentId,
    }

    if (apply) {
      await prisma.project.create({ data }).catch((e) => {
        summary.warnings.push({ label, reason: `Write failed: ${e.message}` })
      })
    }
  }

  return summary
}

// ── Runner ─────────────────────────────────────────────────────────

export async function runDmfImport(sheetId: string, departmentId: string, apply: boolean) {
  const [indexes, mappingCache] = await Promise.all([buildDmfIndexes(departmentId), loadMappingCache()])

  const preparation = await importVaPreparation(sheetId, departmentId, indexes, mappingCache, apply)
  const performance = await importPerformanceMonitoring(sheetId, departmentId, indexes, mappingCache, apply)
  const availability = await importVaAvailability(sheetId, departmentId, indexes, apply)
  const projects = await importProjects(sheetId, departmentId, apply)

  return [preparation, performance, availability, projects]
}
