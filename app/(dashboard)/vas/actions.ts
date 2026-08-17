'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { randomBytes } from 'node:crypto'
import { requireRole, requireAdminMutator, requireAuth, VA_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { generateEmployeeId } from '@/lib/employee-id'
import { normalizeWhatsApp, normalizeGcash } from '@/lib/phone'
import { OFFBOARDING_TYPE_LABELS as TERMINATION_TYPE_LABELS } from '@/lib/offboarding'
import { canApproveClearanceDepartment } from '@/lib/offboarding-permissions'
import { DEPARTMENT_CHECKLISTS } from '@/lib/offboarding'
import { addWorkingDays } from '@/lib/working-days'
import { nextTerminationTicketNumber } from '@/lib/tickets'
import { createResignationCase } from '@/lib/resignation-case'
import type { Prisma } from '@/src/generated/prisma/client'
import type {
  Proficiency,
  EmploymentStatus,
  GeneralStatus,
  TerminationType,
  ReplacementPipelineStatus,
  ExitClearanceDepartment,
  ClearanceApprovalStatus,
} from '@/src/generated/prisma/enums'

// BR-02: standard notice period is 30 working days, minimum 2 weeks (10
// working days). BR-09: final payout target is 7 working days from full
// clearance + compliance-review pass.
const DEFAULT_NOTICE_WORKING_DAYS = 30
const MIN_NOTICE_WORKING_DAYS = 10
const PAYOUT_SLA_WORKING_DAYS = 7

const ONBOARDING_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// The VA Masterlist's "Add VA" quick-add modal is the only VA creation path —
// name + department/position only (email optional, auto-generated as a
// placeholder if blank), no redirect so the modal can close and refresh in
// place instead of navigating away. Rate, notes, and skills are filled in
// afterward on the VA's profile page.
export async function quickAddVA(formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const name = ((formData.get('name') as string) ?? '').trim()
  if (!name) throw new Error('Full name is required')

  const parts = name.split(' ')
  const firstName = parts[0]
  const lastName = parts.slice(1).join(' ') || '-'
  const emailInput = ((formData.get('email') as string) ?? '').trim().toLowerCase()
  const email = emailInput || `${firstName.toLowerCase()}-va@placeholder.vaa`
  const departmentId = ((formData.get('departmentId') as string) ?? '').trim() || null
  const positionSkillId = ((formData.get('positionSkillId') as string) ?? '').trim() || null

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) throw new Error('A user with this email already exists')

  const hireDateInput = ((formData.get('hireDate') as string) ?? '').trim()
  const parsedHireDate = hireDateInput ? new Date(hireDateInput) : null
  const hireDate = parsedHireDate && !isNaN(parsedHireDate.getTime()) ? parsedHireDate : new Date()

  const user = await prisma.$transaction(async (tx) => {
    const employeeId = await generateEmployeeId(tx, hireDate)
    return tx.user.create({
      data: {
        email,
        employeeId,
        firstName,
        lastName,
        systemRole: 'VA',
        userType: 'VIRTUAL_ASSISTANT',
        isActive: true,
        vaProfile: { create: { hourlyRate: null, positionSkillId, currentHireDate: hireDate } },
        ...(departmentId ? { memberships: { create: { departmentId, isPrimary: true } } } : {}),
      },
    })
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    after: { email, employeeId: user.employeeId, firstName, lastName, departmentId, positionSkillId, hireDate },
    metadata: { viaForm: 'vas:quick-add' },
  })

  await prisma.employmentRecord.create({
    data: {
      userId: user.id,
      contractType: 'REGULAR',
      employmentStatus: 'ENGAGED',
      startDate: hireDate,
      effectiveDate: hireDate,
      isCurrent: true,
      initiatedBy: actor.id,
    },
  })

  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.users, 'default')

  return { userId: user.id, employeeId: user.employeeId }
}

// Generates (or regenerates) a unique, time-limited onboarding invite for a
// VA HR just created. The returned token is turned into a public link
// (`/onboard/<token>`) that HR copies and sends manually — there's no email
// integration yet. Re-calling this for the same VA rotates the token, which
// doubles as "resend link" for an unused invite.
export async function createVAOnboardingInvite(userId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, systemRole: true } })
  if (!user) throw new Error('VA not found')
  if (user.systemRole !== 'VA') throw new Error('Onboarding invites are only for VAs')

  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + ONBOARDING_INVITE_TTL_MS)

  const invite = await prisma.vAOnboardingInvite.upsert({
    where: { userId },
    create: { userId, token, expiresAt, createdBy: actor.id },
    update: { token, expiresAt, completedAt: null, createdBy: actor.id },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'VAOnboardingInvite',
    entityId: invite.id,
    after: { userId, expiresAt },
  })

  return { token, expiresAt }
}

export async function addVASkill(vaProfileId: string, skillId: string, proficiency: string, yearsExperience?: number) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const va = await prisma.vAProfile.findUnique({ where: { id: vaProfileId }, select: { userId: true } })
  if (!va) throw new Error('VA profile not found')

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { name: true } })
  if (!skill) throw new Error('Service not found')

  await prisma.vASkill.create({
    data: {
      vaProfileId,
      skillId,
      proficiency: proficiency as Proficiency,
      yearsExperience: yearsExperience ?? null,
    },
  })

  await prisma.vAHistory.create({
    data: {
      userId: va.userId,
      eventType: 'UPSKILL',
      oldValue: null,
      newValue: skill.name,
      effectiveDate: new Date(),
      changedById: actor.id,
    },
  })

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
}

export type VACsvRow = {
  firstName: string
  middleName?: string
  lastName?: string
  extName?: string
  email?: string
  hourlyRate?: string
  baseRate?: string
  vaaPosition?: string
  level?: string
  department?: string
  availabilityStatus?: string
  recommendability?: string
  status?: string
  onHold?: string
  engagementStatus?: string
  hireDate?: string
  eocDate?: string
  hybrid?: string
  preferredWorkHours?: string
  availableSchedule?: string
  phone?: string
  personalEmail?: string
  workEmail?: string
  gender?: string
  birthDate?: string
  birthdayCelebrant?: string
  addressLine?: string
  barangay?: string
  cityMunicipality?: string
  province?: string
  zipCode?: string
  landmark?: string
  gcashNumber?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  emergencyContactRelation?: string
  facebookName?: string
  facebookUrl?: string
  linkedinUrl?: string
  notes?: string
}

export type VACsvImportResult = {
  created: number
  updated: number
  skipped: { row: number; reason: string }[]
}

const CSV_AVAILABILITY_VALUES = ['AVAILABLE', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE']
const CSV_STATUS_VALUES = ['ACTIVE', 'PENDING', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED', 'BLACKLISTED']
const CSV_ENGAGEMENT_VALUES = ['EMPLOYED', 'ENGAGED', 'CONTRACTED', 'END_OF_CONTRACT', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'BLACKLISTED']

function normalizeEnum(value: string | undefined, allowed: string[]): string | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return allowed.includes(normalized) ? normalized : null
}

// A malformed date cell (typo, wrong format, stray text) would otherwise
// silently become `Invalid Date`, which Prisma either rejects with a
// cryptic error or — depending on the field — can store as garbage.
// Surface it as a normal per-row skip reason instead.
function parseDateCell(value: string | undefined): { date: Date | null; error: string | null } {
  const trimmed = (value || '').trim()
  if (!trimmed) return { date: null, error: null }
  const date = new Date(trimmed)
  if (Number.isNaN(date.getTime())) {
    return { date: null, error: `Invalid date "${trimmed}"` }
  }
  return { date, error: null }
}

const CSV_IMPORT_BATCH_SIZE = 20

export async function bulkImportVAs(rowsInput: VACsvRow[], overwriteExisting = false): Promise<VACsvImportResult> {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const result: VACsvImportResult = { created: 0, updated: 0, skipped: [] }

  // A VA can appear multiple times in the source file (department transfers,
  // re-engagements, service changes) — each row is a distinct employment
  // episode, not a duplicate to discard. Group rows by person so the latest
  // row drives the current User/VAProfile state while every row (including
  // older ones) still becomes its own EmploymentRecord below.
  const personKey = (row: VACsvRow) => {
    const email = (row.email || '').trim().toLowerCase()
    if (email) return `email:${email}`
    const first = (row.firstName || '').trim().toLowerCase()
    const last = (row.lastName || '').trim().toLowerCase() || '-'
    return `name:${first}|${last}`
  }
  const rowGroups = new Map<string, VACsvRow[]>()
  const rowGroupOrder: string[] = []
  for (const row of rowsInput) {
    if (!(row.firstName || '').trim()) {
      // Let the missing-name check below skip it with a proper message —
      // give it its own single-row group so it's still visited in order.
      const soloKey = `__no-name-${rowGroupOrder.length}__`
      rowGroups.set(soloKey, [row])
      rowGroupOrder.push(soloKey)
      continue
    }
    const key = personKey(row)
    const existing = rowGroups.get(key)
    if (existing) {
      existing.push(row)
    } else {
      rowGroups.set(key, [row])
      rowGroupOrder.push(key)
    }
  }
  // Within each person's group, the row with the latest hireDate represents
  // their current state; ties/unparseable dates fall back to file order.
  const rows: VACsvRow[] = []
  const currentRowOfGroup = new Map<VACsvRow, VACsvRow[]>()
  for (const key of rowGroupOrder) {
    const group = rowGroups.get(key)!
    let latest = group[0]
    let latestTime = latest.hireDate ? new Date(latest.hireDate).getTime() : -Infinity
    for (const row of group.slice(1)) {
      const rowTime = row.hireDate ? new Date(row.hireDate).getTime() : -Infinity
      if (!Number.isNaN(rowTime) && (Number.isNaN(latestTime) || rowTime >= latestTime)) {
        latest = row
        latestTime = rowTime
      }
    }
    rows.push(latest)
    currentRowOfGroup.set(latest, group)
  }

  // Pre-fetch lookups once instead of per-row to avoid thousands of sequential round-trips.
  // Match against every user, not just existing VAs — a CSV row can refer to
  // someone already in the system under a different userType (e.g. created
  // via another flow), and importing should promote that account to a VA
  // rather than colliding on the unique email constraint trying to create one.
  const existingVAs = await prisma.user.findMany({
    select: { id: true, email: true, firstName: true, middleName: true, lastName: true, extName: true, userType: true },
  })
  const normalizeNameKey = (first: string, last: string) =>
    `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`
  // Full-name key catches VAs imported before the name-column split, whose
  // firstName/lastName boundary may not line up with a re-import's split.
  const normalizeFullNameKey = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' ').trim().toLowerCase().replace(/\s+/g, ' ')
  // Two different people can share a first+last name. Building these as a
  // plain Map means the second one silently overwrites the first's entry,
  // so a CSV row can match — and get its data overwritten onto — the wrong
  // person. Track keys that map to more than one user and refuse to
  // auto-match on those; email match (which is unique) still works fine.
  const AMBIGUOUS = Symbol('ambiguous')
  const buildUniqueKeyMap = (entries: [string, string][]) => {
    const map = new Map<string, string | typeof AMBIGUOUS>()
    for (const [key, id] of entries) {
      if (!key) continue
      const existing = map.get(key)
      if (existing === undefined) map.set(key, id)
      else if (existing !== id) map.set(key, AMBIGUOUS)
    }
    return map
  }
  const nameKeyMap = buildUniqueKeyMap(existingVAs.map((u) => [normalizeNameKey(u.firstName, u.lastName), u.id]))
  const fullNameKeyMap = buildUniqueKeyMap(
    existingVAs.map((u) => [normalizeFullNameKey(u.firstName, u.middleName, u.lastName, u.extName), u.id]),
  )
  const existingIdByNameKey = {
    get: (key: string): string | undefined => {
      const v = nameKeyMap.get(key)
      return v === AMBIGUOUS ? undefined : v
    },
  }
  const existingIdByFullNameKey = {
    get: (key: string): string | undefined => {
      const v = fullNameKeyMap.get(key)
      return v === AMBIGUOUS ? undefined : v
    },
  }
  const existingIdByEmail = new Map(existingVAs.map((u) => [u.email, u.id]))

  const departments = await prisma.department.findMany({ select: { id: true, name: true } })
  const normalizeDeptName = (name: string) =>
    name.trim().toLowerCase().replace(/\s+department$/, '').trim()
  const departmentIdByNormalizedName = new Map(
    departments.map((d) => [normalizeDeptName(d.name), d.id]),
  )

  // Match CSV position text against Skill.name or Skill.shortName; free text
  // is always kept in vaaPosition regardless, so unmatched values aren't lost.
  const skills = await prisma.skill.findMany({ select: { id: true, name: true, shortName: true } })
  const skillIdByNormalizedText = new Map<string, string>()
  for (const s of skills) {
    skillIdByNormalizedText.set(s.name.trim().toLowerCase(), s.id)
    if (s.shortName) skillIdByNormalizedText.set(s.shortName.trim().toLowerCase(), s.id)
  }

  type PreparedRow = {
    rowNum: number
    email: string
    firstName: string
    middleName: string | null
    lastName: string
    extName: string | null
    hourlyRate: number | null
    baseRate: number | null
    vaaPosition: string | null
    positionSkillId: string | null
    level: string | null
    availabilityStatus: string | null
    recommendability: string | null
    status: string | null
    onHold: boolean
    engagementStatus: string | null
    hireDate: Date | null
    eocDate: Date | null
    hybrid: boolean
    preferredWorkHours: number | null
    availableSchedule: string | null
    notes: string | null
    phone: string | null
    personalEmail: string | null
    workEmail: string | null
    gender: string | null
    birthDate: Date | null
    birthdayCelebrant: boolean | undefined
    addressLine: string | null
    barangay: string | null
    cityMunicipality: string | null
    province: string | null
    zipCode: string | null
    landmark: string | null
    gcashNumber: string | null
    emergencyContactName: string | null
    emergencyContactPhone: string | null
    emergencyContactRelation: string | null
    facebookName: string | null
    facebookUrl: string | null
    linkedinUrl: string | null
    departmentInput: string
    departmentId: string | null
    matchedUserId: string | null
    historyEntries: HistoryEntry[]
  }

  // One employment episode from the source file — the current row and every
  // older/duplicate row for the same person each become one of these, so
  // department transfers and re-engagements are preserved as real history
  // instead of being discarded by the latest-row-wins grouping above.
  type HistoryEntry = {
    departmentId: string | null
    employmentStatus: EmploymentStatus | null
    startDate: Date
    endDate: Date | null
  }

  const prepared: PreparedRow[] = []
  const seenEmails = new Set<string>()

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // account for header row, 1-indexed
    const row = rows[i]
    const firstName = (row.firstName || '').trim()

    if (!firstName) {
      result.skipped.push({ row: rowNum, reason: 'Missing first name' })
      continue
    }

    const emailInput = (row.email || '').trim().toLowerCase()
    const lastNameInput = (row.lastName || '').trim() || '-'
    const nameKey = normalizeNameKey(firstName, lastNameInput)
    const fullNameKey = normalizeFullNameKey(firstName, row.middleName, lastNameInput, row.extName)

    const matchedByEmail = emailInput ? existingIdByEmail.get(emailInput) : undefined
    const matchedUserId = matchedByEmail
      ?? existingIdByNameKey.get(nameKey)
      ?? existingIdByFullNameKey.get(fullNameKey)
      ?? null

    if (matchedUserId && !overwriteExisting) {
      result.skipped.push({
        row: rowNum,
        reason: matchedByEmail
          ? `User already exists: ${emailInput}`
          : `User already exists: ${firstName} ${lastNameInput}`,
      })
      continue
    }
    if (!matchedUserId && emailInput && seenEmails.has(emailInput)) {
      result.skipped.push({ row: rowNum, reason: `Duplicate email in file: ${emailInput}` })
      continue
    }

    // A blank Status cell must not fall through to Prisma's schema default of
    // ACTIVE for a brand-new, unreviewed VA — land them on UNIDENTIFIED
    // instead so HR can see they still need a real status assigned.
    // Existing VAs with a blank cell are unaffected; updateOne already leaves
    // their current status untouched rather than overwriting it.
    const statusInput = normalizeEnum(row.status, CSV_STATUS_VALUES) ?? (matchedUserId ? null : 'UNIDENTIFIED')

    const birthDateResult = parseDateCell(row.birthDate)
    const hireDateResult = parseDateCell(row.hireDate)
    const eocDateResult = parseDateCell(row.eocDate)
    const dateError = birthDateResult.error
      ? `birthDate: ${birthDateResult.error}`
      : hireDateResult.error
        ? `hireDate: ${hireDateResult.error}`
        : eocDateResult.error
          ? `eocDate: ${eocDateResult.error}`
          : null
    if (dateError) {
      result.skipped.push({ row: rowNum, reason: dateError })
      continue
    }
    const birthDate = birthDateResult.date
    const hireDate = hireDateResult.date
    const eocDate = eocDateResult.date

    if (emailInput) seenEmails.add(emailInput)

    const email = emailInput || `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-va-${Date.now()}-${i}@placeholder.vaa`

    const hourlyRateInput = (row.hourlyRate || '').trim()
    const baseRateInput = (row.baseRate || '').trim()
    const preferredWorkHoursInput = (row.preferredWorkHours || '').trim()
    const hourlyRate = hourlyRateInput && !Number.isNaN(Number(hourlyRateInput)) ? Number(hourlyRateInput) : null
    const baseRate = baseRateInput && !Number.isNaN(Number(baseRateInput)) ? Number(baseRateInput) : null
    const preferredWorkHours = preferredWorkHoursInput && !Number.isNaN(Number(preferredWorkHoursInput)) ? Number(preferredWorkHoursInput) : null
    const hybrid = (row.hybrid || '').trim().toLowerCase() === 'true' || (row.hybrid || '').trim().toLowerCase() === 'yes'
    // A VA landing on UNIDENTIFIED hasn't been reviewed at all yet — don't
    // pair that with an On Hold badge, since On Hold implies a real,
    // reviewed status that's been deliberately paused.
    const onHold = statusInput === 'UNIDENTIFIED'
      ? false
      : (row.onHold || '').trim().toLowerCase() === 'true' || (row.onHold || '').trim().toLowerCase() === 'yes'
    const birthdayCelebrantInput = (row.birthdayCelebrant || '').trim().toLowerCase()
    const birthdayCelebrant = birthdayCelebrantInput ? (birthdayCelebrantInput === 'true' || birthdayCelebrantInput === 'yes') : undefined

    const departmentInput = (row.department || '').trim()
    const departmentId = departmentInput ? departmentIdByNormalizedName.get(normalizeDeptName(departmentInput)) ?? null : null

    // Build one history entry per row in this person's group (current row
    // included) so every employment episode from the file — not just the
    // latest — lands as its own EmploymentRecord. A sibling row with a bad
    // date or no date at all just contributes no history entry rather than
    // failing the whole person.
    const siblingRows = currentRowOfGroup.get(row) ?? [row]
    const historyEntries: HistoryEntry[] = []
    for (const sibling of siblingRows) {
      const siblingHire = parseDateCell(sibling.hireDate)
      if (siblingHire.error || !siblingHire.date) continue
      const siblingEoc = parseDateCell(sibling.eocDate)
      if (siblingEoc.error) continue
      const siblingDeptInput = (sibling.department || '').trim()
      const siblingDeptId = siblingDeptInput
        ? departmentIdByNormalizedName.get(normalizeDeptName(siblingDeptInput)) ?? null
        : null
      historyEntries.push({
        departmentId: siblingDeptId,
        employmentStatus: normalizeEnum(sibling.engagementStatus, CSV_ENGAGEMENT_VALUES) as EmploymentStatus | null,
        startDate: siblingHire.date,
        endDate: siblingEoc.date,
      })
    }
    historyEntries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

    prepared.push({
      rowNum,
      email,
      firstName,
      middleName: (row.middleName || '').trim() || null,
      lastName: (row.lastName || '').trim() || '-',
      extName: (row.extName || '').trim() || null,
      hourlyRate,
      baseRate,
      vaaPosition: (row.vaaPosition || '').trim() || null,
      positionSkillId: (row.vaaPosition || '').trim()
        ? skillIdByNormalizedText.get((row.vaaPosition || '').trim().toLowerCase()) ?? null
        : null,
      level: (row.level || '').trim() || null,
      availabilityStatus: normalizeEnum(row.availabilityStatus, CSV_AVAILABILITY_VALUES),
      recommendability: (row.recommendability || '').trim() || null,
      status: statusInput,
      onHold,
      engagementStatus: normalizeEnum(row.engagementStatus, CSV_ENGAGEMENT_VALUES),
      hireDate,
      eocDate,
      hybrid,
      preferredWorkHours,
      availableSchedule: (row.availableSchedule || '').trim() || null,
      notes: (row.notes || '').trim() || null,
      phone: (row.phone || '').trim() || null,
      personalEmail: (row.personalEmail || '').trim() || null,
      workEmail: (row.workEmail || '').trim() || null,
      gender: (row.gender || '').trim() || null,
      birthDate,
      birthdayCelebrant,
      addressLine: (row.addressLine || '').trim() || null,
      barangay: (row.barangay || '').trim() || null,
      cityMunicipality: (row.cityMunicipality || '').trim() || null,
      province: (row.province || '').trim() || null,
      zipCode: (row.zipCode || '').trim() || null,
      landmark: (row.landmark || '').trim() || null,
      gcashNumber: row.gcashNumber?.trim() ? normalizeGcash(row.gcashNumber) : null,
      emergencyContactName: (row.emergencyContactName || '').trim() || null,
      emergencyContactPhone: (row.emergencyContactPhone || '').trim() || null,
      emergencyContactRelation: (row.emergencyContactRelation || '').trim() || null,
      facebookName: (row.facebookName || '').trim() || null,
      facebookUrl: (row.facebookUrl || '').trim() || null,
      linkedinUrl: (row.linkedinUrl || '').trim() || null,
      departmentInput,
      departmentId,
      matchedUserId,
      historyEntries,
    })
  }

  // Reconciles a person's full employment history against `entries` (one per
  // CSV row for that person, oldest first): matches existing EmploymentRecords
  // by (startDate, departmentId) so re-importing the same file doesn't create
  // duplicates, updates the matched ones, creates the rest, and marks exactly
  // the last entry (by startDate) as isCurrent — everything older gets
  // isCurrent:false so it reads as history rather than the active record.
  const syncEmploymentHistory = async (userId: string, entries: HistoryEntry[]) => {
    if (entries.length === 0) return
    const existing = await prisma.employmentRecord.findMany({ where: { userId } })
    const matchKey = (departmentId: string | null, startDate: Date) =>
      `${departmentId ?? '-'}|${startDate.toISOString().slice(0, 10)}`
    const existingByKey = new Map(existing.map((r) => [matchKey(r.departmentId, r.startDate), r]))

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]
      const isCurrent = i === entries.length - 1
      const key = matchKey(entry.departmentId, entry.startDate)
      const match = existingByKey.get(key)
      const data = {
        departmentId: entry.departmentId,
        contractType: 'REGULAR' as const,
        employmentStatus: entry.employmentStatus ?? (isCurrent ? 'ENGAGED' as const : 'END_OF_CONTRACT' as const),
        startDate: entry.startDate,
        endDate: entry.endDate,
        effectiveDate: entry.startDate,
        isCurrent,
      }
      if (match) {
        await prisma.employmentRecord.update({ where: { id: match.id }, data })
      } else {
        await prisma.employmentRecord.create({
          data: { ...data, userId, initiatedBy: actor.id },
        })
      }
    }
  }

  const updateOne = async (p: PreparedRow) => {
    const userId = p.matchedUserId!
    try {
      const userData: Record<string, unknown> = {
        firstName: p.firstName,
        lastName: p.lastName,
      }
      if (p.middleName !== null) userData.middleName = p.middleName
      if (p.extName !== null) userData.extName = p.extName

      const vaProfileData: Record<string, unknown> = { onHold: p.onHold }
      if (p.hourlyRate !== null) vaProfileData.hourlyRate = p.hourlyRate
      if (p.baseRate !== null) vaProfileData.baseRate = p.baseRate
      if (p.vaaPosition !== null) {
        vaProfileData.vaaPosition = p.vaaPosition
        vaProfileData.positionSkillId = p.positionSkillId
      }
      if (p.level !== null) vaProfileData.level = p.level
      if (p.availabilityStatus !== null) vaProfileData.availabilityStatus = p.availabilityStatus as any
      if (p.recommendability !== null) vaProfileData.recommendability = p.recommendability
      if (p.status !== null) vaProfileData.status = p.status as any
      if (p.engagementStatus !== null) vaProfileData.engagementStatus = p.engagementStatus as any
      if (p.hireDate !== null) vaProfileData.currentHireDate = p.hireDate
      if (p.eocDate !== null) vaProfileData.currentEndDate = p.eocDate
      if (p.preferredWorkHours !== null) vaProfileData.preferredWorkHours = p.preferredWorkHours
      if (p.availableSchedule !== null) vaProfileData.availableSchedule = p.availableSchedule
      if (p.notes !== null) vaProfileData.notes = p.notes
      vaProfileData.hybrid = p.hybrid

      const profileData: Record<string, unknown> = {}
      if (p.phone !== null) profileData.phone = p.phone
      if (p.personalEmail !== null) profileData.personalEmail = p.personalEmail
      if (p.workEmail !== null) profileData.workEmail = p.workEmail
      if (p.gender !== null) profileData.gender = p.gender
      if (p.birthDate !== null) profileData.birthDate = p.birthDate
      if (p.birthdayCelebrant !== undefined) profileData.birthdayCelebrant = p.birthdayCelebrant
      if (p.addressLine !== null) profileData.addressLine = p.addressLine
      if (p.barangay !== null) profileData.barangay = p.barangay
      if (p.cityMunicipality !== null) profileData.cityMunicipality = p.cityMunicipality
      if (p.province !== null) profileData.province = p.province
      if (p.zipCode !== null) profileData.zipCode = p.zipCode
      if (p.landmark !== null) profileData.landmark = p.landmark
      if (p.gcashNumber !== null) profileData.gcashNumber = p.gcashNumber
      if (p.emergencyContactName !== null) profileData.emergencyContactName = p.emergencyContactName
      if (p.emergencyContactPhone !== null) profileData.emergencyContactPhone = p.emergencyContactPhone
      if (p.emergencyContactRelation !== null) profileData.emergencyContactRelation = p.emergencyContactRelation
      if (p.facebookName !== null) profileData.facebookName = p.facebookName
      if (p.facebookUrl !== null) profileData.facebookUrl = p.facebookUrl
      if (p.linkedinUrl !== null) profileData.linkedinUrl = p.linkedinUrl

      await prisma.user.update({
        where: { id: userId },
        data: {
          ...userData,
          userType: 'VIRTUAL_ASSISTANT',
          systemRole: 'VA',
          vaProfile: {
            upsert: {
              create: { ...vaProfileData, currentHireDate: p.hireDate ?? new Date(), currentEndDate: p.eocDate },
              update: vaProfileData,
            },
          },
          profile: { upsert: { create: profileData, update: profileData } },
        },
      })

      if (p.departmentId) {
        const existingMembership = await prisma.departmentMembership.findFirst({
          where: { userId, departmentId: p.departmentId, endedAt: null },
        })
        if (!existingMembership) {
          await prisma.departmentMembership.create({
            data: { userId, departmentId: p.departmentId, isPrimary: true },
          })
        }
      }

      // The Roster's "Engagement Status" column reads EmploymentRecord.employmentStatus,
      // not VAProfile.engagementStatus directly — sync every employment episode from
      // this person's rows (not just the current one) so history stays intact.
      await syncEmploymentHistory(userId, p.historyEntries)

      await logAudit({
        actorId: actor.id,
        action: 'UPDATE',
        entityType: 'User',
        entityId: userId,
        after: { email: p.email, firstName: p.firstName, lastName: p.lastName, department: p.departmentInput || null },
        metadata: { viaImport: 'vas/csv', overwrite: true },
      })

      result.updated++
    } catch (e) {
      result.skipped.push({ row: p.rowNum, reason: e instanceof Error ? e.message : 'Failed to update' })
    }
  }

  const createOne = async (p: PreparedRow) => {
    try {
      const user = await prisma.user.create({
        data: {
          email: p.email,
          firstName: p.firstName,
          middleName: p.middleName,
          lastName: p.lastName,
          extName: p.extName,
          systemRole: 'VA',
          userType: 'VIRTUAL_ASSISTANT',
          vaProfile: {
            create: {
              hourlyRate: p.hourlyRate,
              baseRate: p.baseRate,
              vaaPosition: p.vaaPosition,
              positionSkillId: p.positionSkillId,
              level: p.level,
              availabilityStatus: (p.availabilityStatus as any) ?? undefined,
              recommendability: p.recommendability,
              status: p.status as GeneralStatus,
              onHold: p.onHold,
              engagementStatus: (p.engagementStatus as any) ?? undefined,
              currentHireDate: p.hireDate ?? new Date(),
              currentEndDate: p.eocDate,
              hybrid: p.hybrid,
              preferredWorkHours: p.preferredWorkHours,
              availableSchedule: p.availableSchedule,
              notes: p.notes,
            },
          },
          profile: {
            create: {
              phone: p.phone,
              personalEmail: p.personalEmail,
              workEmail: p.workEmail,
              gender: p.gender,
              birthDate: p.birthDate,
              birthdayCelebrant: p.birthdayCelebrant,
              addressLine: p.addressLine,
              barangay: p.barangay,
              cityMunicipality: p.cityMunicipality,
              province: p.province,
              zipCode: p.zipCode,
              landmark: p.landmark,
              gcashNumber: p.gcashNumber,
              emergencyContactName: p.emergencyContactName,
              emergencyContactPhone: p.emergencyContactPhone,
              emergencyContactRelation: p.emergencyContactRelation,
              facebookName: p.facebookName,
              facebookUrl: p.facebookUrl,
              linkedinUrl: p.linkedinUrl,
            },
          },
          ...(p.departmentId ? { memberships: { create: { departmentId: p.departmentId, isPrimary: true } } } : {}),
        },
        include: { vaProfile: true },
      })

      await Promise.all([
        logAudit({
          actorId: actor.id,
          action: 'CREATE',
          entityType: 'User',
          entityId: user.id,
          after: { email: p.email, firstName: p.firstName, lastName: p.lastName, hourlyRate: p.hourlyRate, department: p.departmentInput || null },
          metadata: { viaImport: 'vas/csv' },
        }),
        syncEmploymentHistory(
          user.id,
          p.historyEntries.length > 0
            ? p.historyEntries
            : [{ departmentId: p.departmentId, employmentStatus: p.engagementStatus as EmploymentStatus | null, startDate: p.hireDate ?? new Date(), endDate: p.eocDate }],
        ),
      ])

      result.created++
    } catch (e) {
      result.skipped.push({ row: p.rowNum, reason: e instanceof Error ? e.message : 'Failed to create' })
    }
  }

  for (let i = 0; i < prepared.length; i += CSV_IMPORT_BATCH_SIZE) {
    const batch = prepared.slice(i, i + CSV_IMPORT_BATCH_SIZE)
    await Promise.all(batch.map((p) => (p.matchedUserId ? updateOne(p) : createOne(p))))
  }

  if (result.created > 0 || result.updated > 0) {
    revalidatePath('/vas')
    revalidateTag(CACHE_TAGS.vas, 'default')
    revalidateTag(CACHE_TAGS.users, 'default')
  }

  result.skipped.sort((a, b) => a.row - b.row)
  return result
}

export async function updateVAProfile(vaProfileId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const data: Record<string, any> = {}
  const allowedFields = [
    'vaaPosition', 'level', 'baseRate', 'hourlyRate', 'notes',
    'preferredWorkHours', 'availableSchedule', 'hybrid', 'availabilityStatus',
    'status', 'engagementStatus', 'currentHireDate',
    'contractLink', 'folder201Link', 'file201Link', 'vaClientFileLink',
    'healthCheckFileLink', 'portfolioUrl', 'vaProfileLink', 'payoutSummaryLink', 'dept201FolderLink',
  ]

  for (const field of allowedFields) {
    const value = formData.get(field)
    if (value !== null) {
      if (field === 'hybrid') {
        data[field] = value === 'true'
      } else if (field === 'baseRate' || field === 'hourlyRate' || field === 'preferredWorkHours') {
        data[field] = value ? Number(value) : null
      } else if (field === 'currentHireDate') {
        data[field] = value ? new Date(value as string) : null
      } else {
        data[field] = value || null
      }
    }
  }

  const before = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { userId: true, vaaPosition: true, level: true, baseRate: true, hourlyRate: true, preferredWorkHours: true, availabilityStatus: true, hybrid: true, status: true, engagementStatus: true },
  })

  await prisma.vAProfile.update({ where: { id: vaProfileId }, data })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    before: before ? { ...before } : undefined,
    after: data,
    metadata: { fields: Object.keys(data) },
  })

  if (before) {
    const rateHistory: { field: 'hourlyRate' | 'baseRate'; old: number | null; next: number | null }[] = []
    if ('hourlyRate' in data && Number(before.hourlyRate ?? null) !== Number(data.hourlyRate ?? null)) {
      rateHistory.push({ field: 'hourlyRate', old: before.hourlyRate ? Number(before.hourlyRate) : null, next: data.hourlyRate })
    }
    if ('baseRate' in data && Number(before.baseRate ?? null) !== Number(data.baseRate ?? null)) {
      rateHistory.push({ field: 'baseRate', old: before.baseRate ? Number(before.baseRate) : null, next: data.baseRate })
    }
    for (const change of rateHistory) {
      await prisma.vAHistory.create({
        data: {
          userId: before.userId,
          eventType: 'RATE_CHANGE',
          oldValue: change.old != null ? `${change.field}:${change.old}` : null,
          newValue: change.next != null ? `${change.field}:${change.next}` : null,
          effectiveDate: new Date(),
          changedById: actor.id,
        },
      })
    }
  }

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.vas, 'default')
}

export async function changeVAStatus(
  vaProfileId: string,
  statusType: 'GENERAL' | 'ENGAGEMENT',
  newValue: string,
  effectiveDate?: string,
  reason?: string
) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const field = statusType === 'GENERAL' ? 'status' : 'engagementStatus'
  const before = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { userId: true, status: true, engagementStatus: true },
  })
  if (!before) throw new Error('VA profile not found')

  const oldValue = statusType === 'GENERAL' ? before.status : before.engagementStatus

  const effective = effectiveDate ? new Date(effectiveDate) : new Date()
  if (Number.isNaN(effective.getTime())) throw new Error('Invalid effective date')

  await prisma.$transaction([
    prisma.vAProfile.update({ where: { id: vaProfileId }, data: { [field]: newValue } }),
    prisma.vAHistory.create({
      data: {
        userId: before.userId,
        eventType: statusType === 'GENERAL' ? 'STATUS_CHANGE' : 'ENGAGEMENT_CHANGE',
        oldValue: oldValue ?? null,
        newValue,
        effectiveDate: effective,
        reason: reason?.trim() || null,
        changedById: actor.id,
      },
    }),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'VAProfile',
    entityId: vaProfileId,
    before: { [field]: oldValue },
    after: { [field]: newValue },
    metadata: { statusType, effectiveDate: effective.toISOString(), reason: reason?.trim() || undefined },
  })

  const TERMINAL_ENGAGEMENT_VALUES = ['END_OF_CONTRACT', 'RESIGNED', 'TERMINATED', 'BLACKLISTED']
  if (statusType === 'ENGAGEMENT' && TERMINAL_ENGAGEMENT_VALUES.includes(newValue)) {
    const currentRecord = await prisma.employmentRecord.findFirst({
      where: { userId: before.userId, isCurrent: true },
    })
    if (currentRecord) {
      await prisma.employmentRecord.update({
        where: { id: currentRecord.id },
        data: { isCurrent: false, endDate: effective, employmentStatus: newValue as EmploymentStatus },
      })
      await prisma.vAProfile.update({
        where: { id: vaProfileId },
        data: { currentEndDate: effective },
      })
    }
  }

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
}

export async function transferVA(
  vaProfileId: string,
  transferType: 'ACTIVE' | 'END_OF_CONTRACT' | 'HYBRID',
  newDepartmentId: string,
  newPositionId: string | null,
  effectiveDate: string,
  reason?: string,
  newHourlyRate?: number,
  newBaseRate?: number
) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const va = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { userId: true },
  })
  if (!va) throw new Error('VA profile not found')

  const effective = new Date(effectiveDate)
  if (Number.isNaN(effective.getTime())) throw new Error('Invalid effective date')

  const currentMembership = await prisma.departmentMembership.findFirst({
    where: { userId: va.userId, endedAt: null, isPrimary: true },
    include: { department: { select: { name: true } } },
  })

  const newDept = await prisma.department.findUnique({ where: { id: newDepartmentId }, select: { name: true } })
  if (!newDept) throw new Error('Department not found')

  const alreadyInDept = await prisma.departmentMembership.findFirst({
    where: { userId: va.userId, departmentId: newDepartmentId, endedAt: null },
  })
  if (alreadyInDept) throw new Error('VA already has an active membership in that department')

  await prisma.$transaction(async (tx) => {
    if (transferType !== 'HYBRID' && currentMembership) {
      await tx.departmentMembership.update({
        where: { id: currentMembership.id },
        data: { endedAt: effective },
      })
    }

    const created = await tx.departmentMembership.create({
      data: {
        userId: va.userId,
        departmentId: newDepartmentId,
        positionId: newPositionId,
        isPrimary: transferType !== 'HYBRID',
        hourlyRate: newHourlyRate ?? null,
        baseRate: newBaseRate ?? null,
        transferType,
        transferredFromId: currentMembership?.id ?? null,
        startedAt: effective,
      },
    })

    if (transferType === 'END_OF_CONTRACT' && currentMembership) {
      await tx.vAProfile.update({
        where: { id: vaProfileId },
        data: { engagementStatus: 'END_OF_CONTRACT' },
      })
      await tx.vAHistory.create({
        data: {
          userId: va.userId,
          eventType: 'ENGAGEMENT_CHANGE',
          oldValue: null,
          newValue: 'END_OF_CONTRACT',
          departmentId: currentMembership.departmentId,
          effectiveDate: effective,
          reason: reason?.trim() || null,
          changedById: actor.id,
        },
      })
    }

    await tx.vAHistory.create({
      data: {
        userId: va.userId,
        eventType: 'DEPARTMENT_TRANSFER',
        oldValue: currentMembership?.department.name ?? null,
        newValue: newDept.name,
        departmentId: newDepartmentId,
        effectiveDate: effective,
        reason: reason?.trim() || null,
        changedById: actor.id,
      },
    })

    const priorRecord = await tx.employmentRecord.findFirst({ where: { userId: va.userId, isCurrent: true } })
    if (priorRecord) {
      await tx.employmentRecord.update({
        where: { id: priorRecord.id },
        data: { isCurrent: transferType === 'HYBRID' ? priorRecord.isCurrent : false, endDate: transferType === 'HYBRID' ? priorRecord.endDate : effective },
      })
    }
    await tx.employmentRecord.create({
      data: {
        userId: va.userId,
        departmentId: newDepartmentId,
        contractType: 'REGULAR',
        employmentStatus: transferType === 'END_OF_CONTRACT' ? 'TRANSFERRED' : 'ENGAGED',
        startDate: effective,
        effectiveDate: effective,
        isCurrent: true,
        initiatedBy: actor.id,
        reason: reason?.trim() || null,
      },
    })

    await tx.vAProfile.update({
      where: { id: vaProfileId },
      data: { currentHireDate: effective, currentEndDate: null },
    })

    return created
  })

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function updateUserProfile(userId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const data: Record<string, any> = {}
  const userData: Record<string, any> = {}
  const allowedFields = [
    'firstName', 'middleName', 'lastName', 'extName', 'gender', 'birthDate', 'nonCelebrant',
    'whatsappNumber', 'gcashNumber', 'phone',
    'barangay', 'cityMunicipality', 'province', 'houseNumber', 'zipCode', 'landmark', 'address',
    'regionCode', 'provinceCode', 'cityCode', 'barangayCode',
    'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation', 'religion',
    'facebookUrl', 'facebookName', 'linkedinUrl',
    'payoneerAccount', 'payoneerId', 'personalEmail', 'workEmail',
    'passportNumber', 'passportPhoto', 'philhealthNumber', 'philhealthPhoto',
    'signedContract',
  ]

  // AddressFields (components/vas/AddressFields.tsx) submits the PSGC cascade
  // under an "address." prefix (namePrefix="address"), not as bare field names.
  const ADDRESS_CASCADE_FIELDS = new Set([
    'barangay', 'cityMunicipality', 'province', 'regionCode', 'provinceCode', 'cityCode', 'barangayCode',
  ])

  for (const field of allowedFields) {
    const formKey = ADDRESS_CASCADE_FIELDS.has(field) ? `address.${field}` : field
    const value = formData.get(formKey)
    if (value !== null) {
      if (field === 'nonCelebrant') {
        data[field] = value === 'true'
      } else if (field === 'birthDate') {
        data[field] = value ? new Date(value as string) : null
      } else if (field === 'whatsappNumber') {
        data[field] = value ? normalizeWhatsApp(value as string) : null
      } else if (field === 'gcashNumber') {
        data[field] = value ? normalizeGcash(value as string) : null
      } else {
        data[field] = value || null
      }
    }
  }

  if ('firstName' in data) { userData.firstName = data.firstName; delete data.firstName }
  if ('middleName' in data) { userData.middleName = data.middleName; delete data.middleName }
  if ('lastName' in data) { userData.lastName = data.lastName; delete data.lastName }
  if ('extName' in data) { userData.extName = data.extName; delete data.extName }

  const changedFields: string[] = []

  if (Object.keys(userData).length > 0) {
    const beforeUser = await prisma.user.findUnique({ where: { id: userId }, select: Object.fromEntries(Object.keys(userData).map(k => [k, true])) })
    await prisma.user.update({ where: { id: userId }, data: userData })
    changedFields.push(...Object.keys(userData))
    await logAudit({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'User',
      entityId: userId,
      before: beforeUser ? { ...beforeUser } : undefined,
      after: userData,
    })
  }

  if (Object.keys(data).length > 0) {
    const beforeProfile = await prisma.userProfile.findUnique({ where: { userId }, select: Object.fromEntries(Object.keys(data).map(k => [k, true])) })
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
    changedFields.push(...Object.keys(data))
    await logAudit({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'UserProfile',
      entityId: userId,
      before: beforeProfile ? { ...beforeProfile } : undefined,
      after: data,
      metadata: { fields: Object.keys(data) },
    })
  }

  revalidatePath(`/vas/${userId}`)
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.users, 'default')
}

export { updateUserProfile as updateUserProfileAction }

export async function updateEmployment(vaProfileId: string, userId: string, formData: FormData) {
  await requireRole(...VA_MUTATOR_ROLES)
  await updateVAProfile(vaProfileId, formData)
  await updateUserProfile(userId, formData)
}


// Replaces the raw Engagement Status dropdown for terminal outcomes — instead
// of silently flipping a status field, this generates a system Ticket
// (category TERMINATION) HR/System Admin can track, classified Type A (EOC) /
// B (client-initiated) / C (VAA-initiated) per the 2026-08-04 Workforce System
// Feedback Review meeting. Scope is either one Assignment (that client
// relationship ends, VA stays active elsewhere) or the whole VAProfile (all
// assignments end) — whole-VA terminations also auto-create the exit survey
// invite + clearance checklist.
export async function terminateVA(formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const vaProfileId = (formData.get('vaProfileId') as string) || ''
  const assignmentId = (formData.get('assignmentId') as string) || null
  const type = (formData.get('type') as string) || ''
  const resultingStatus = (formData.get('resultingStatus') as string) || ''
  const affectsBothParties = formData.get('affectsBothParties') === 'true'
  const reason = ((formData.get('reason') as string) || '').trim() || null
  const effectiveDateInput = (formData.get('effectiveDate') as string) || ''

  if (!vaProfileId || !type || !resultingStatus) throw new Error('Missing required termination fields')

  const effective = effectiveDateInput ? new Date(effectiveDateInput) : new Date()
  if (Number.isNaN(effective.getTime())) throw new Error('Invalid effective date')

  const va = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: {
      userId: true,
      user: {
        select: {
          firstName: true,
          lastName: true,
          memberships: { where: { isPrimary: true, endedAt: null }, select: { departmentId: true } },
        },
      },
    },
  })
  if (!va) throw new Error('VA profile not found')

  if (assignmentId) {
    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId }, select: { vaProfileId: true } })
    if (!assignment || assignment.vaProfileId !== vaProfileId) throw new Error('Assignment does not belong to this VA')
  }

  const vaName = `${va.user.firstName} ${va.user.lastName}`.trim()
  const departmentId = va.user.memberships[0]?.departmentId ?? null
  const ticketNumber = await nextTerminationTicketNumber()

  const { ticketId, terminationId } = await prisma.$transaction(async (tx) => {
    const ticket = await tx.ticket.create({
      data: {
        ticketNumber,
        title: `Offboarding — ${vaName} (${TERMINATION_TYPE_LABELS[type] ?? type})`,
        description: reason ?? `System-generated offboarding ticket for ${vaName}, ending ${assignmentId ? 'one assignment' : 'all assignments'}.`,
        category: 'TERMINATION',
        priority: 'HIGH',
        source: 'INTERNAL',
        createdBy: actor.id,
        departmentId,
      },
    })

    const termination = await tx.termination.create({
      data: {
        vaProfileId,
        assignmentId,
        type: type as TerminationType,
        affectsBothParties,
        resultingStatus: resultingStatus as EmploymentStatus,
        reason,
        ticketId: ticket.id,
        initiatedById: actor.id,
        effectiveDate: effective,
        // Per-assignment terminations have no exit survey/clearance step —
        // only whole-VA offboarding does, so those start further back in the workflow.
        workflowStatus: assignmentId ? 'COMPLETED' : 'EXIT_SURVEY_PENDING',
        completedAt: assignmentId ? new Date() : null,
      },
    })

    if (assignmentId) {
      await tx.assignment.update({ where: { id: assignmentId }, data: { status: 'COMPLETED', endDate: effective } })
    } else {
      await tx.vAProfile.update({
        where: { id: vaProfileId },
        data: { engagementStatus: resultingStatus as EmploymentStatus, currentEndDate: effective },
      })
      await tx.vAHistory.create({
        data: {
          userId: va.userId,
          eventType: 'ENGAGEMENT_CHANGE',
          newValue: resultingStatus,
          effectiveDate: effective,
          reason: reason ?? undefined,
          changedById: actor.id,
        },
      })
      const currentRecord = await tx.employmentRecord.findFirst({ where: { userId: va.userId, isCurrent: true } })
      if (currentRecord) {
        await tx.employmentRecord.update({
          where: { id: currentRecord.id },
          data: { isCurrent: false, endDate: effective, employmentStatus: resultingStatus as EmploymentStatus },
        })
      }
    }

    return { ticketId: ticket.id, terminationId: termination.id }
  })

  if (!assignmentId) {
    const token = randomBytes(32).toString('base64url')
    await prisma.exitSurveyInvite.create({
      data: {
        terminationId,
        token,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
    })
    await prisma.exitClearance.create({ data: { terminationId } })
  }

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { vaProfileId, assignmentId, type, resultingStatus, affectsBothParties, reason },
    metadata: { ticketId },
    departmentId,
  })

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)

  return { ticketId, terminationId }
}

const CLEARANCE_CHECKLIST_FIELDS = ['equipmentReturned', 'accountsRevoked', 'documentsSubmitted', 'finalPayCleared'] as const

export async function updateExitClearance(clearanceId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const data: Record<string, boolean> = {}
  for (const field of CLEARANCE_CHECKLIST_FIELDS) data[field] = formData.get(field) === 'true'
  const outstandingBalanceNote = ((formData.get('outstandingBalanceNote') as string) || '').trim() || null
  const allCleared = CLEARANCE_CHECKLIST_FIELDS.every((field) => data[field])

  const clearance = await prisma.exitClearance.update({
    where: { id: clearanceId },
    data: {
      ...data,
      outstandingBalanceNote,
      clearedById: allCleared ? actor.id : null,
      clearedAt: allCleared ? new Date() : null,
    },
    include: { termination: { select: { id: true, ticketId: true, workflowStatus: true } } },
  })

  if (allCleared && clearance.termination.workflowStatus !== 'COMPLETED') {
    await prisma.termination.update({
      where: { id: clearance.termination.id },
      data: { workflowStatus: 'COMPLETED', completedAt: new Date() },
    })
  } else if (!allCleared && clearance.termination.workflowStatus === 'COMPLETED') {
    await prisma.termination.update({
      where: { id: clearance.termination.id },
      data: { workflowStatus: 'CLEARANCE_PENDING', completedAt: null },
    })
  }

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'ExitClearance',
    entityId: clearanceId,
    after: data,
  })

  if (clearance.termination.ticketId) revalidatePath(`/tickets/${clearance.termination.ticketId}`)
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${clearance.termination.id}`)
}

// ──────────────────────────────────────────────────────────────────────
// Resignation SOP extension (2026-08-14 Workforce Management System
// meeting) — the voluntary-resignation sub-flow layered on top of the
// Termination model above (discussion/retention → letter → replacement →
// exit survey → 5-department clearance → compliance review → payout SLA).
// terminateVA()/updateExitClearance() above are untouched and keep serving
// the simple EOC/CLIENT_INITIATED/plain-removal paths.
// ──────────────────────────────────────────────────────────────────────

function parseFormDate(value: FormDataEntryValue | null): Date | null {
  const str = (value as string | null)?.trim()
  if (!str) return null
  const d = new Date(str)
  return Number.isNaN(d.getTime()) ? null : d
}

// FR-001: starts the resignation case at intent, before any discussion has
// happened. effectiveDate is a placeholder until the discussion sets the
// real Last Working Day (submitResignationLetter refines it further).
// Creates the tracking Ticket immediately (mirrors terminateVA()) — every
// later stage's UI (TerminationPanel/ResignationSections) is rendered on
// the ticket detail page, so without one here the case would be an
// orphaned DB row with no page to continue it from.
export async function initiateResignation(formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const vaProfileId = (formData.get('vaProfileId') as string) || ''
  const assignmentId = (formData.get('assignmentId') as string) || null
  const reason = ((formData.get('reason') as string) || '').trim() || null
  if (!vaProfileId) throw new Error('Missing VA profile')

  const { terminationId, ticketId } = await createResignationCase({
    actorId: actor.id,
    vaProfileId,
    assignmentId,
    reason,
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { vaProfileId, assignmentId, isVoluntaryResignation: true },
    metadata: { ticketId },
  })

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/tickets')
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)

  return { terminationId, ticketId }
}

// FR-002/FR-003/BR-01/BR-02: logs the TL-VA discussion outcome. Retained
// closes the case (matching CANCELLED's existing semantics); not retained
// requires a Last Working Day, defaulting to a 30-working-day notice period
// (min. 2 weeks unless an override reason is captured).
export async function logDiscussionOutcome(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({ where: { id: terminationId } })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'INITIATED') {
    throw new Error('The discussion outcome can only be logged once, before the letter stage.')
  }

  const retained = formData.get('retained') === 'true'
  const recordingLink = ((formData.get('recordingLink') as string) || '').trim() || null
  const turnoverDiscussed = formData.get('turnoverDiscussed') === 'true'
  const conductedAt = new Date()

  if (retained) {
    await prisma.$transaction([
      prisma.resignationDiscussion.upsert({
        where: { terminationId },
        create: { terminationId, conductedAt, retained: true, recordingLink, turnoverDiscussed },
        update: { conductedAt, retained: true, recordingLink, turnoverDiscussed },
      }),
      prisma.termination.update({
        where: { id: terminationId },
        data: { workflowStatus: 'CANCELLED', reason: 'VA retained during discussion', completedAt: new Date() },
      }),
    ])
    await logAudit({
      actorId: actor.id,
      action: 'STATUS_CHANGE',
      entityType: 'Termination',
      entityId: terminationId,
      after: { workflowStatus: 'CANCELLED', retained: true },
    })
    revalidatePath(`/vas/${termination.vaProfileId}`)
    revalidatePath('/offboarding')
    revalidatePath(`/offboarding/${terminationId}`)
    return
  }

  const overrideReason = ((formData.get('lwdOverrideReason') as string) || '').trim() || null
  let lastWorkingDay = parseFormDate(formData.get('lastWorkingDay'))
  if (!lastWorkingDay) {
    lastWorkingDay = addWorkingDays(conductedAt, DEFAULT_NOTICE_WORKING_DAYS)
  } else {
    const minDate = addWorkingDays(new Date(), MIN_NOTICE_WORKING_DAYS)
    if (lastWorkingDay.getTime() < minDate.getTime() && !overrideReason) {
      throw new Error('Last Working Day is under the 2-week minimum notice — provide an override reason to proceed.')
    }
  }

  await prisma.$transaction([
    prisma.resignationDiscussion.upsert({
      where: { terminationId },
      create: {
        terminationId,
        conductedAt,
        retained: false,
        recordingLink,
        turnoverDiscussed,
        lastWorkingDay,
        lwdOverrideReason: overrideReason,
        lwdOverrideById: overrideReason ? actor.id : null,
      },
      update: {
        conductedAt,
        retained: false,
        recordingLink,
        turnoverDiscussed,
        lastWorkingDay,
        lwdOverrideReason: overrideReason,
        lwdOverrideById: overrideReason ? actor.id : null,
      },
    }),
    prisma.termination.update({
      where: { id: terminationId },
      data: { workflowStatus: 'PENDING_LETTER', effectiveDate: lastWorkingDay },
    }),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'PENDING_LETTER' },
    metadata: overrideReason ? { lwdOverrideReason: overrideReason } : undefined,
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-004/BR-03: validates the 3 mandatory letter fields and starts the
// ReplacementRequest pipeline. The tracking Ticket already exists (created
// at initiateResignation) — this just updates it with the now-known
// customer name.
export async function submitResignationLetter(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({
    where: { id: terminationId },
    include: { discussion: true },
  })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'PENDING_LETTER') {
    throw new Error('The resignation letter can only be submitted after the discussion outcome (not retained).')
  }
  if (!termination.discussion?.lastWorkingDay) throw new Error('Last Working Day must be set first.')

  const customerName = ((formData.get('customerName') as string) || '').trim()
  const effectiveDate = parseFormDate(formData.get('effectiveDate'))
  const attachmentUrl = ((formData.get('attachmentUrl') as string) || '').trim() || null
  if (!customerName || !effectiveDate) throw new Error('Customer name and effective date are required (BR-03).')

  await prisma.$transaction([
    prisma.termination.update({
      where: { id: terminationId },
      data: { resignationDocUrl: attachmentUrl, effectiveDate, workflowStatus: 'UNDER_DOCUMENTATION' },
    }),
    prisma.replacementRequest.upsert({
      where: { terminationId },
      update: {},
      create: { terminationId },
    }),
    ...(termination.ticketId
      ? [
          prisma.ticket.update({
            where: { id: termination.ticketId },
            data: { description: `Resignation case — Customer: ${customerName}.${termination.reason ? ` ${termination.reason}` : ''}` },
          }),
        ]
      : []),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'UNDER_DOCUMENTATION' },
    metadata: { customerName },
  })

  revalidatePath(`/vas/${termination.vaProfileId}`)
  if (termination.ticketId) revalidatePath(`/tickets/${termination.ticketId}`)
  revalidateTag(CACHE_TAGS.tickets, 'default')
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-008: Replacement Request pipeline, sourced by the Service Department.
export async function updateReplacementRequest(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const pipelineStatus = (formData.get('pipelineStatus') as string) || ''
  const validStatuses: ReplacementPipelineStatus[] = ['SOURCED', 'ENDORSED', 'INTERVIEWED', 'APPROVED', 'REJECTED', 'NOT_APPLICABLE']
  if (!validStatuses.includes(pipelineStatus as ReplacementPipelineStatus)) {
    throw new Error('Missing or invalid pipeline status')
  }
  const candidateUserId = (formData.get('candidateUserId') as string) || null

  const termination = await prisma.termination.findUnique({ where: { id: terminationId } })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'UNDER_DOCUMENTATION') {
    throw new Error('The replacement request can only be updated while under documentation.')
  }

  const isApproved = pipelineStatus === 'APPROVED'
  await prisma.replacementRequest.upsert({
    where: { terminationId },
    update: {
      pipelineStatus: pipelineStatus as ReplacementPipelineStatus,
      candidateUserId,
      approvedById: isApproved ? actor.id : null,
      approvedAt: isApproved ? new Date() : null,
    },
    create: {
      terminationId,
      pipelineStatus: pipelineStatus as ReplacementPipelineStatus,
      candidateUserId,
      approvedById: isApproved ? actor.id : null,
      approvedAt: isApproved ? new Date() : null,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'ReplacementRequest',
    entityId: terminationId,
    after: { pipelineStatus },
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-009/FR-010: logs customer notification once the replacement gate
// clears (Approved or Not Applicable), then auto-generates the Exit Survey
// invite — reusing terminateVA's exact token/expiry pattern.
export async function logCustomerNotification(terminationId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({
    where: { id: terminationId },
    include: { replacementRequest: true },
  })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'UNDER_DOCUMENTATION') {
    throw new Error('Customer notification can only be logged while under documentation.')
  }
  const replacementOk =
    termination.replacementRequest &&
    ['APPROVED', 'NOT_APPLICABLE'].includes(termination.replacementRequest.pipelineStatus)
  if (!replacementOk) throw new Error('The Replacement Request must be Approved or marked Not Applicable first.')

  const token = randomBytes(32).toString('base64url')
  await prisma.$transaction([
    prisma.exitSurveyInvite.create({
      data: { terminationId, token, expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) },
    }),
    prisma.termination.update({ where: { id: terminationId }, data: { workflowStatus: 'EXIT_SURVEY_PENDING' } }),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'EXIT_SURVEY_PENDING' },
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  if (termination.ticketId) revalidatePath(`/tickets/${termination.ticketId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

const CLEARANCE_DEPARTMENTS: ExitClearanceDepartment[] = [
  'SERVICE_DEPARTMENT',
  'CUSTOMER_SUCCESS',
  'TRAINING',
  'ACCOUNTING',
  'HR',
]

// FR-011/BR-06: fans out the 5 independent, parallel department clearance
// sub-tasks. Only callable once the Exit Survey invite is completed.
export async function initiateExitClearance(terminationId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({
    where: { id: terminationId },
    include: { exitSurveyInvite: true, clearanceApprovals: true },
  })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'EXIT_SURVEY_PENDING') {
    throw new Error('Exit Clearance can only be initiated from Exit Survey Pending.')
  }
  if (!termination.exitSurveyInvite?.completedAt) {
    throw new Error('The Exit Survey must be completed first (BR-05).')
  }
  if (termination.clearanceApprovals.length > 0) {
    throw new Error('Exit Clearance has already been initiated for this case.')
  }

  await prisma.$transaction([
    prisma.termination.update({ where: { id: terminationId }, data: { workflowStatus: 'CLEARANCE_PROCESSING' } }),
    prisma.exitClearanceApproval.createMany({
      data: CLEARANCE_DEPARTMENTS.map((department) => ({
        terminationId,
        department,
        checklistItems: DEPARTMENT_CHECKLISTS[department].map((label) => ({ label, checked: false })),
        // No-login public approval link (app/exit-clearance/[token]) — lets
        // each department act without an account in this system.
        token: randomBytes(32).toString('base64url'),
      })),
    }),
  ])

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'CLEARANCE_PROCESSING' },
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  if (termination.ticketId) revalidatePath(`/tickets/${termination.ticketId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-011/FR-012/BR-06: one department approving or rejecting its own
// sub-task, gated per-department via canApproveClearanceDepartment() — not
// the flat VA_MUTATOR_ROLES gate the legacy single checklist uses, since no
// single department should be able to unilaterally clear all 5. A
// rejection only reopens that department — the other 4 stay untouched. All
// 5 Approved advances the case to Compliance Review Pending.
export async function actOnClearanceApproval(approvalId: string, formData: FormData) {
  const actor = await requireAuth()

  const statusRaw = (formData.get('status') as string) || ''
  const comments = ((formData.get('comments') as string) || '').trim() || null
  if (!['APPROVED', 'REJECTED'].includes(statusRaw)) throw new Error('Missing or invalid decision.')
  if (statusRaw === 'REJECTED' && !comments) {
    throw new Error('A comment describing the outstanding requirement is required when rejecting (FR-012).')
  }

  const approval = await prisma.exitClearanceApproval.findUnique({
    where: { id: approvalId },
    include: { termination: { include: { vaProfile: { select: { userId: true } } } } },
  })
  if (!approval) throw new Error('Approval not found.')
  if (approval.termination.workflowStatus !== 'CLEARANCE_PROCESSING') {
    throw new Error('This clearance is no longer open for department action.')
  }

  const canApprove = await canApproveClearanceDepartment(actor, approval.department, approval.termination.vaProfile.userId)
  if (!canApprove) throw new Error(`You are not authorized to act on the ${approval.department} clearance.`)

  await prisma.exitClearanceApproval.update({
    where: { id: approvalId },
    data: { status: statusRaw as ClearanceApprovalStatus, approverId: actor.id, comments, actionDate: new Date() },
  })

  const allApprovals = await prisma.exitClearanceApproval.findMany({ where: { terminationId: approval.terminationId } })
  const allApproved = allApprovals.every((a) => (a.id === approvalId ? statusRaw === 'APPROVED' : a.status === 'APPROVED'))

  if (allApproved) {
    await prisma.termination.update({
      where: { id: approval.terminationId },
      data: { workflowStatus: 'COMPLIANCE_REVIEW_PENDING' },
    })
    await logAudit({
      actorId: actor.id,
      action: 'STATUS_CHANGE',
      entityType: 'Termination',
      entityId: approval.terminationId,
      after: { workflowStatus: 'COMPLIANCE_REVIEW_PENDING' },
      metadata: { reason: 'All 5 departments approved' },
    })
  }

  await logAudit({
    actorId: actor.id,
    action: statusRaw === 'APPROVED' ? 'APPROVE' : 'REJECT',
    entityType: 'ExitClearanceApproval',
    entityId: approvalId,
    after: { status: statusRaw, comments },
    metadata: { department: approval.department },
  })

  revalidatePath(`/vas/${approval.termination.vaProfileId}`)
  if (approval.termination.ticketId) revalidatePath(`/tickets/${approval.termination.ticketId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${approval.terminationId}`)
}

// FR-013/BR-10: the fixed 5-item policy checklist gating the endorsement to
// Accounting. A Flagged result routes the specific implicated department
// back to Pending rather than resetting all 5 (edge case in the design
// doc). A Pass immediately endorses to Accounting and starts the
// 7-working-day payout SLA (BR-08/BR-09) — folded into this one action per
// the SOP, where the same reviewer typically does both in sequence.
export async function submitComplianceReview(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({ where: { id: terminationId } })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'COMPLIANCE_REVIEW_PENDING') {
    throw new Error('Compliance review can only be submitted once all 5 departments have approved.')
  }

  const checklist = {
    properlyConducted: formData.get('properlyConducted') === 'true',
    voluntaryConfirmation: formData.get('voluntaryConfirmation') === 'true',
    noticePeriodCommunicated: formData.get('noticePeriodCommunicated') === 'true',
    noUnresolvedIssues: formData.get('noUnresolvedIssues') === 'true',
    turnoverAcknowledged: formData.get('turnoverAcknowledged') === 'true',
  }
  const overallResult = Object.values(checklist).every(Boolean) ? 'PASS' : 'FLAGGED'
  const flaggedDepartmentRaw = (formData.get('flaggedDepartment') as string) || ''
  const flaggedDepartment = CLEARANCE_DEPARTMENTS.includes(flaggedDepartmentRaw as ExitClearanceDepartment)
    ? (flaggedDepartmentRaw as ExitClearanceDepartment)
    : null

  await prisma.complianceReview.upsert({
    where: { terminationId },
    update: { ...checklist, overallResult, reviewedById: actor.id, reviewedAt: new Date() },
    create: { terminationId, ...checklist, overallResult, reviewedById: actor.id, reviewedAt: new Date() },
  })

  if (overallResult === 'PASS') {
    const endorsedAt = new Date()
    const slaDueDate = addWorkingDays(endorsedAt, PAYOUT_SLA_WORKING_DAYS)
    await prisma.$transaction([
      prisma.termination.update({ where: { id: terminationId }, data: { workflowStatus: 'PAYOUT_PENDING' } }),
      prisma.finalPayout.upsert({
        where: { terminationId },
        update: {},
        create: { terminationId, endorsedById: actor.id, endorsedAt, slaDueDate },
      }),
    ])
    await logAudit({
      actorId: actor.id,
      action: 'STATUS_CHANGE',
      entityType: 'Termination',
      entityId: terminationId,
      after: { workflowStatus: 'PAYOUT_PENDING' },
      metadata: { slaDueDate: slaDueDate.toISOString() },
    })
  } else {
    const updates: Prisma.PrismaPromise<unknown>[] = [
      prisma.termination.update({ where: { id: terminationId }, data: { workflowStatus: 'CLEARANCE_PROCESSING' } }),
    ]
    if (flaggedDepartment) {
      updates.push(
        prisma.exitClearanceApproval.updateMany({
          where: { terminationId, department: flaggedDepartment },
          data: { status: 'PENDING', comments: null },
        })
      )
    }
    await prisma.$transaction(updates)
    await logAudit({
      actorId: actor.id,
      action: 'STATUS_CHANGE',
      entityType: 'Termination',
      entityId: terminationId,
      after: { workflowStatus: 'CLEARANCE_PROCESSING' },
      metadata: { flagged: true, flaggedDepartment },
    })
  }

  revalidatePath(`/vas/${termination.vaProfileId}`)
  if (termination.ticketId) revalidatePath(`/tickets/${termination.ticketId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-016/FR-017/FR-018/BR-11/BR-12: records the payout and — the moment
// it's processed — auto-transitions workforce status per the case's scope,
// reusing terminateVA()'s exact update block for the whole-VA path: ends
// the Assignment only (Customer-Only, VA stays engaged elsewhere), or sets
// VAProfile.engagementStatus/currentEndDate + VAHistory + EmploymentRecord
// (Customer+Company, the whole engagement ends) — deferred until now rather
// than at intake, since the SOP conditions it on full clearance + payout.
export async function recordFinalPayout(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const amountRaw = (formData.get('amount') as string) || ''
  const amount = Number(amountRaw)
  if (!amountRaw || !Number.isFinite(amount) || amount <= 0) throw new Error('A valid payout amount is required.')

  const termination = await prisma.termination.findUnique({
    where: { id: terminationId },
    include: { finalPayout: true, vaProfile: { select: { userId: true } } },
  })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (termination.workflowStatus !== 'PAYOUT_PENDING' || !termination.finalPayout) {
    throw new Error('There is no pending payout to record for this case.')
  }

  const processedAt = new Date()
  const vaUserId = termination.vaProfile.userId

  await prisma.$transaction(async (tx) => {
    await tx.finalPayout.update({
      where: { terminationId },
      data: { amount, processedAt, status: 'PROCESSED' },
    })
    await tx.termination.update({
      where: { id: terminationId },
      data: { workflowStatus: 'COMPLETED', completedAt: processedAt },
    })

    if (termination.assignmentId) {
      await tx.assignment.update({
        where: { id: termination.assignmentId },
        data: { status: 'COMPLETED', endDate: processedAt },
      })
    } else {
      await tx.vAProfile.update({
        where: { id: termination.vaProfileId },
        data: { engagementStatus: 'RESIGNED', currentEndDate: processedAt },
      })
      await tx.vAHistory.create({
        data: {
          userId: vaUserId,
          eventType: 'ENGAGEMENT_CHANGE',
          newValue: 'RESIGNED',
          effectiveDate: processedAt,
          reason: termination.reason ?? undefined,
          changedById: actor.id,
        },
      })
      const currentRecord = await tx.employmentRecord.findFirst({ where: { userId: vaUserId, isCurrent: true } })
      if (currentRecord) {
        await tx.employmentRecord.update({
          where: { id: currentRecord.id },
          data: { isCurrent: false, endDate: processedAt, employmentStatus: 'RESIGNED' },
        })
      }
    }
  })

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'COMPLETED' },
    metadata: { amount },
  })

  revalidatePath(`/vas/${termination.vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  if (termination.ticketId) revalidatePath(`/tickets/${termination.ticketId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

// FR-017, Customer-Only path only: confirms the VA cleared the
// reassignment training gate. A manual toggle, not a full training
// sub-module — retrying on failure is just calling this again later.
export async function markTrainingPassed(terminationId: string) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const termination = await prisma.termination.findUnique({ where: { id: terminationId } })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (!termination.assignmentId) {
    throw new Error('Training/assessment only applies to the Customer-Only path.')
  }
  if (termination.workflowStatus !== 'COMPLETED') {
    throw new Error('Training can only be marked passed after the case is completed.')
  }

  await prisma.termination.update({
    where: { id: terminationId },
    data: { trainingPassedAt: new Date(), trainingNotedById: actor.id },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { trainingPassedAt: true },
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

const WITHDRAWABLE_STATUSES = ['INITIATED', 'PENDING_LETTER', 'UNDER_DOCUMENTATION', 'EXIT_SURVEY_PENDING']

// FR-021: withdrawal is only self-service before Exit Clearance starts —
// past that point the SOP treats it as an exception requiring manual
// escalation rather than a standard path, which this simply blocks.
export async function withdrawResignation(terminationId: string, formData: FormData) {
  const actor = await requireRole(...VA_MUTATOR_ROLES)

  const reason = ((formData.get('reason') as string) || '').trim()
  if (!reason) throw new Error('A reason is required to withdraw a resignation (FR-021).')

  const termination = await prisma.termination.findUnique({ where: { id: terminationId } })
  if (!termination || !termination.isVoluntaryResignation) throw new Error('Not a resignation case')
  if (!WITHDRAWABLE_STATUSES.includes(termination.workflowStatus)) {
    throw new Error('This case can no longer be withdrawn — Exit Clearance has already started. Escalate to HR instead.')
  }

  await prisma.termination.update({
    where: { id: terminationId },
    data: { workflowStatus: 'CANCELLED', reason, completedAt: new Date() },
  })

  await logAudit({
    actorId: actor.id,
    action: 'STATUS_CHANGE',
    entityType: 'Termination',
    entityId: terminationId,
    after: { workflowStatus: 'CANCELLED' },
    metadata: { reason, withdrawn: true },
  })
  revalidatePath(`/vas/${termination.vaProfileId}`)
  revalidatePath('/offboarding')
  revalidatePath(`/offboarding/${terminationId}`)
}

export async function updateUserProfileFiles(
  userId: string,
  passportPhoto: string | null,
  philhealthPhoto: string | null,
  signedContract: string | null
) {
  await requireRole(...VA_MUTATOR_ROLES)

  await prisma.userProfile.upsert({
    where: { userId },
    create: {
      userId,
      passportPhoto: passportPhoto,
      philhealthPhoto: philhealthPhoto,
      signedContract: signedContract,
    },
    update: {
      passportPhoto: passportPhoto,
      philhealthPhoto: philhealthPhoto,
      signedContract: signedContract,
    },
  })

  revalidatePath(`/vas/${userId}`)
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.users, 'default')
}

export type BulkDeleteVAsResult = {
  deactivated: number
  failed: { vaProfileId: string; reason: string }[]
}

export async function bulkDeleteVAs(vaProfileIds: string[]): Promise<BulkDeleteVAsResult> {
  const actor = await requireAdminMutator()

  const result: BulkDeleteVAsResult = { deactivated: 0, failed: [] }
  const uniqueIds = Array.from(new Set(vaProfileIds))

  for (const vaProfileId of uniqueIds) {
    const va = await prisma.vAProfile.findUnique({
      where: { id: vaProfileId },
      select: { userId: true, status: true, engagementStatus: true },
    })
    if (!va) {
      result.failed.push({ vaProfileId, reason: 'VA not found' })
      continue
    }

    const effective = new Date()

    await prisma.$transaction([
      prisma.vAProfile.update({
        where: { id: vaProfileId },
        data: { status: 'REMOVED' },
      }),
      prisma.user.update({
        where: { id: va.userId },
        data: { isActive: false, status: 'REMOVED' },
      }),
      prisma.vAHistory.create({
        data: {
          userId: va.userId,
          eventType: 'STATUS_CHANGE',
          oldValue: va.status,
          newValue: 'REMOVED',
          effectiveDate: effective,
          reason: 'Bulk deactivation by admin',
          changedById: actor.id,
        },
      }),
    ])

    await logAudit({
      actorId: actor.id,
      action: 'DELETE',
      entityType: 'VAProfile',
      entityId: vaProfileId,
      before: { status: va.status },
      after: { status: 'REMOVED' },
      metadata: { bulk: true },
    })

    result.deactivated++
  }

  if (result.deactivated > 0) {
    revalidatePath('/vas')
    revalidateTag(CACHE_TAGS.vas, 'default')
    revalidateTag(CACHE_TAGS.users, 'default')
  }

  return result
}

