'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, requireAdminMutator } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { Proficiency, EmploymentStatus } from '@/src/generated/prisma/enums'

export async function createVA(formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

  const email = formData.get('email') as string
  const nameVal = (formData.get('name') as string) || ''
  const firstName = nameVal.split(' ')[0] || ''
  const lastName = nameVal.split(' ').slice(1).join(' ') || ''
  const hourlyRate = formData.get('hourlyRate') as string
  const notes = (formData.get('notes') as string) || null
  const skillIds = formData.getAll('skillIds') as string[]

  const hireDate = new Date()

  const user = await prisma.user.create({
    data: {
      email,
      firstName,
      lastName,
      systemRole: 'VA',
      userType: 'VIRTUAL_ASSISTANT',
      vaProfile: {
        create: {
          hourlyRate: hourlyRate ? Number(hourlyRate) : null,
          notes,
          currentHireDate: hireDate,
          vaSkills: { create: skillIds.map((skillId) => ({ skillId })) },
        },
      },
    },
    include: { vaProfile: true },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'User',
    entityId: user.id,
    after: { email, firstName, lastName },
  })

  await prisma.employmentRecord.create({
    data: {
      userId: user.id,
      contractType: 'REGULAR',
      employmentStatus: 'EMPLOYED',
      startDate: hireDate,
      effectiveDate: hireDate,
      isCurrent: true,
      initiatedBy: actor.id,
    },
  })

  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.users, 'default')
  redirect(`/vas/${user.vaProfile!.id}`)
}

export async function addVASkill(vaProfileId: string, skillId: string, proficiency: string, yearsExperience?: number) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

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
const CSV_STATUS_VALUES = ['ACTIVE', 'PENDING', 'TRANSFERRED', 'RESIGNED', 'REMOVED', 'PROJECT_ENDED', 'CANCELLED']
const CSV_ENGAGEMENT_VALUES = ['EMPLOYED', 'ENGAGED', 'CONTRACTED', 'END_OF_CONTRACT', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'BLACKLISTED']

function normalizeEnum(value: string | undefined, allowed: string[]): string | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return allowed.includes(normalized) ? normalized : null
}

const CSV_IMPORT_BATCH_SIZE = 20

export async function bulkImportVAs(rows: VACsvRow[], overwriteExisting = false): Promise<VACsvImportResult> {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

  const result: VACsvImportResult = { created: 0, updated: 0, skipped: [] }

  // Pre-fetch lookups once instead of per-row to avoid thousands of sequential round-trips.
  const emailInputs = rows
    .map((row) => (row.email || '').trim().toLowerCase())
    .filter(Boolean)

  const existingVAs = await prisma.user.findMany({
    where: { userType: 'VIRTUAL_ASSISTANT' },
    select: { id: true, email: true, firstName: true, middleName: true, lastName: true, extName: true },
  })
  const existingEmails = new Set(existingVAs.map((u) => u.email))
  const normalizeNameKey = (first: string, last: string) =>
    `${first.trim().toLowerCase()}|${last.trim().toLowerCase()}`
  // Full-name key catches VAs imported before the name-column split, whose
  // firstName/lastName boundary may not line up with a re-import's split.
  const normalizeFullNameKey = (...parts: (string | null | undefined)[]) =>
    parts.filter(Boolean).join(' ').trim().toLowerCase().replace(/\s+/g, ' ')
  const existingIdByNameKey = new Map(
    existingVAs.map((u) => [normalizeNameKey(u.firstName, u.lastName), u.id]),
  )
  const existingIdByFullNameKey = new Map(
    existingVAs.map((u) => [normalizeFullNameKey(u.firstName, u.middleName, u.lastName, u.extName), u.id]),
  )
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

    const matchedUserId = (emailInput ? existingIdByEmail.get(emailInput) : undefined)
      ?? existingIdByNameKey.get(nameKey)
      ?? existingIdByFullNameKey.get(fullNameKey)
      ?? null

    if (matchedUserId && !overwriteExisting) {
      result.skipped.push({
        row: rowNum,
        reason: emailInput && existingEmails.has(emailInput)
          ? `Email already exists: ${emailInput}`
          : `VA already exists: ${firstName} ${lastNameInput}`,
      })
      continue
    }
    if (!matchedUserId && emailInput && seenEmails.has(emailInput)) {
      result.skipped.push({ row: rowNum, reason: `Duplicate email in file: ${emailInput}` })
      continue
    }
    if (emailInput) seenEmails.add(emailInput)

    const email = emailInput || `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-va-${Date.now()}-${i}@placeholder.vaa`

    const hourlyRateInput = (row.hourlyRate || '').trim()
    const baseRateInput = (row.baseRate || '').trim()
    const preferredWorkHoursInput = (row.preferredWorkHours || '').trim()
    const hourlyRate = hourlyRateInput && !Number.isNaN(Number(hourlyRateInput)) ? Number(hourlyRateInput) : null
    const baseRate = baseRateInput && !Number.isNaN(Number(baseRateInput)) ? Number(baseRateInput) : null
    const preferredWorkHours = preferredWorkHoursInput && !Number.isNaN(Number(preferredWorkHoursInput)) ? Number(preferredWorkHoursInput) : null
    const hybrid = (row.hybrid || '').trim().toLowerCase() === 'true' || (row.hybrid || '').trim().toLowerCase() === 'yes'
    const onHold = (row.onHold || '').trim().toLowerCase() === 'true' || (row.onHold || '').trim().toLowerCase() === 'yes'
    const birthDate = (row.birthDate || '').trim() ? new Date((row.birthDate || '').trim()) : null
    const birthdayCelebrantInput = (row.birthdayCelebrant || '').trim().toLowerCase()
    const birthdayCelebrant = birthdayCelebrantInput ? (birthdayCelebrantInput === 'true' || birthdayCelebrantInput === 'yes') : undefined
    const hireDate = (row.hireDate || '').trim() ? new Date((row.hireDate || '').trim()) : null
    const eocDate = (row.eocDate || '').trim() ? new Date((row.eocDate || '').trim()) : null

    const departmentInput = (row.department || '').trim()
    const departmentId = departmentInput ? departmentIdByNormalizedName.get(normalizeDeptName(departmentInput)) ?? null : null

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
      status: normalizeEnum(row.status, CSV_STATUS_VALUES),
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
      gcashNumber: (row.gcashNumber || '').trim() || null,
      emergencyContactName: (row.emergencyContactName || '').trim() || null,
      emergencyContactPhone: (row.emergencyContactPhone || '').trim() || null,
      emergencyContactRelation: (row.emergencyContactRelation || '').trim() || null,
      facebookName: (row.facebookName || '').trim() || null,
      facebookUrl: (row.facebookUrl || '').trim() || null,
      linkedinUrl: (row.linkedinUrl || '').trim() || null,
      departmentInput,
      departmentId,
      matchedUserId,
    })
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
          vaProfile: { update: vaProfileData },
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
              status: (p.status as any) ?? undefined,
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
        prisma.employmentRecord.create({
          data: {
            userId: user.id,
            departmentId: p.departmentId,
            contractType: 'REGULAR',
            employmentStatus: (p.engagementStatus as EmploymentStatus | null) ?? 'EMPLOYED',
            startDate: p.hireDate ?? new Date(),
            endDate: p.eocDate,
            effectiveDate: p.hireDate ?? new Date(),
            isCurrent: !p.eocDate,
            initiatedBy: actor.id,
          },
        }),
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

  const data: Record<string, any> = {}
  const allowedFields = [
    'vaaPosition', 'level', 'baseRate', 'hourlyRate', 'notes',
    'preferredWorkHours', 'availableSchedule', 'hybrid', 'availabilityStatus',
    'status', 'engagementStatus',
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

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
        employmentStatus: transferType === 'END_OF_CONTRACT' ? 'TRANSFERRED' : 'EMPLOYED',
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

  const data: Record<string, any> = {}
  const userData: Record<string, any> = {}
  const allowedFields = [
    'firstName', 'lastName', 'gender', 'birthDate', 'nonCelebrant',
    'whatsappNumber', 'gcashNumber', 'phone',
    'barangay', 'cityMunicipality', 'province', 'zipCode', 'landmark', 'address',
    'regionCode', 'provinceCode', 'cityCode', 'barangayCode',
    'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
    'facebookUrl', 'facebookName', 'linkedinUrl',
    'payoneerAccount', 'personalEmail', 'workEmail',
    'passportNumber', 'passportPhoto', 'philhealthNumber', 'philhealthPhoto',
    'signedContract',
  ]

  for (const field of allowedFields) {
    const value = formData.get(field)
    if (value !== null) {
      if (field === 'nonCelebrant') {
        data[field] = value === 'true'
      } else if (field === 'birthDate') {
        data[field] = value ? new Date(value as string) : null
      } else {
        data[field] = value || null
      }
    }
  }

  if ('firstName' in data) { userData.firstName = data.firstName; delete data.firstName }
  if ('lastName' in data) { userData.lastName = data.lastName; delete data.lastName }

  const changedFields: string[] = []

  if (Object.keys(userData).length > 0) {
    const beforeUser = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } })
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
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')
  await updateVAProfile(vaProfileId, formData)
  await updateUserProfile(userId, formData)
}

export async function updateUserProfileFiles(
  userId: string,
  passportPhoto: string | null,
  philhealthPhoto: string | null,
  signedContract: string | null
) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER')

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
