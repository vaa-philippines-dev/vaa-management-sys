'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function createVA(formData: FormData) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

  const email = formData.get('email') as string
  const nameVal = (formData.get('name') as string) || ''
  const firstName = nameVal.split(' ')[0] || ''
  const lastName = nameVal.split(' ').slice(1).join(' ') || ''
  const hourlyRate = formData.get('hourlyRate') as string
  const notes = (formData.get('notes') as string) || null
  const skillIds = formData.getAll('skillIds') as string[]

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
          vaSkills: { connect: skillIds.map((id) => ({ id })) },
        },
      },
    },
    include: { vaProfile: true },
  })

  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidateTag(CACHE_TAGS.users, 'default')
  redirect(`/vas/${user.vaProfile!.id}`)
}

export type VACsvRow = {
  name: string
  email?: string
  hourlyRate?: string
  baseRate?: string
  vaaPosition?: string
  level?: string
  department?: string
  availabilityStatus?: string
  status?: string
  engagementStatus?: string
  hybrid?: string
  preferredWorkHours?: string
  availableSchedule?: string
  phone?: string
  personalEmail?: string
  workEmail?: string
  gender?: string
  birthDate?: string
  address?: string
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
  skipped: { row: number; reason: string }[]
}

const CSV_AVAILABILITY_VALUES = ['AVAILABLE', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE']
const CSV_STATUS_VALUES = ['ACTIVE', 'INACTIVE', 'ON_HOLD']
const CSV_ENGAGEMENT_VALUES = ['EMPLOYED', 'ENGAGED', 'CONTRACTED', 'END_OF_CONTRACT', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'BLACKLISTED']

function normalizeEnum(value: string | undefined, allowed: string[]): string | null {
  if (!value) return null
  const normalized = value.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return allowed.includes(normalized) ? normalized : null
}

export async function bulkImportVAs(rows: VACsvRow[]): Promise<VACsvImportResult> {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

  const result: VACsvImportResult = { created: 0, skipped: [] }

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // account for header row, 1-indexed
    const row = rows[i]
    const name = (row.name || '').trim()
    const emailInput = (row.email || '').trim().toLowerCase()
    const hourlyRateInput = (row.hourlyRate || '').trim()
    const baseRateInput = (row.baseRate || '').trim()
    const preferredWorkHoursInput = (row.preferredWorkHours || '').trim()
    const notes = (row.notes || '').trim() || null

    if (!name) {
      result.skipped.push({ row: rowNum, reason: 'Missing name' })
      continue
    }

    const parts = name.split(' ').filter(Boolean)
    const firstName = parts[0] || name
    const lastName = parts.slice(1).join(' ') || '-'
    const email = emailInput || `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}-va-${Date.now()}-${i}@placeholder.vaa`

    const hourlyRate = hourlyRateInput && !Number.isNaN(Number(hourlyRateInput)) ? Number(hourlyRateInput) : null
    const baseRate = baseRateInput && !Number.isNaN(Number(baseRateInput)) ? Number(baseRateInput) : null
    const preferredWorkHours = preferredWorkHoursInput && !Number.isNaN(Number(preferredWorkHoursInput)) ? Number(preferredWorkHoursInput) : null
    const hybrid = (row.hybrid || '').trim().toLowerCase() === 'true' || (row.hybrid || '').trim().toLowerCase() === 'yes'
    const birthDate = (row.birthDate || '').trim() ? new Date((row.birthDate || '').trim()) : null

    const availabilityStatus = normalizeEnum(row.availabilityStatus, CSV_AVAILABILITY_VALUES)
    const status = normalizeEnum(row.status, CSV_STATUS_VALUES)
    const engagementStatus = normalizeEnum(row.engagementStatus, CSV_ENGAGEMENT_VALUES)

    if (emailInput) {
      const existing = await prisma.user.findUnique({ where: { email: emailInput } })
      if (existing) {
        result.skipped.push({ row: rowNum, reason: `Email already exists: ${emailInput}` })
        continue
      }
    }

    let departmentId: string | null = null
    const departmentInput = (row.department || '').trim()
    if (departmentInput) {
      const dept = await prisma.department.findFirst({
        where: { name: { equals: departmentInput, mode: 'insensitive' } },
      })
      departmentId = dept?.id ?? null
    }

    try {
      const user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          systemRole: 'VA',
          userType: 'VIRTUAL_ASSISTANT',
          vaProfile: {
            create: {
              hourlyRate,
              baseRate,
              vaaPosition: (row.vaaPosition || '').trim() || null,
              level: (row.level || '').trim() || null,
              availabilityStatus: (availabilityStatus as any) ?? undefined,
              status: (status as any) ?? undefined,
              engagementStatus: (engagementStatus as any) ?? undefined,
              hybrid,
              preferredWorkHours,
              availableSchedule: (row.availableSchedule || '').trim() || null,
              notes,
            },
          },
          profile: {
            create: {
              phone: (row.phone || '').trim() || null,
              personalEmail: (row.personalEmail || '').trim() || null,
              workEmail: (row.workEmail || '').trim() || null,
              gender: (row.gender || '').trim() || null,
              birthDate,
              address: (row.address || '').trim() || null,
              emergencyContactName: (row.emergencyContactName || '').trim() || null,
              emergencyContactPhone: (row.emergencyContactPhone || '').trim() || null,
              emergencyContactRelation: (row.emergencyContactRelation || '').trim() || null,
              facebookName: (row.facebookName || '').trim() || null,
              facebookUrl: (row.facebookUrl || '').trim() || null,
              linkedinUrl: (row.linkedinUrl || '').trim() || null,
            },
          },
          ...(departmentId ? { memberships: { create: { departmentId, isPrimary: true } } } : {}),
        },
        include: { vaProfile: true },
      })

      await logAudit({
        actorId: actor.id,
        action: 'CREATE',
        entityType: 'User',
        entityId: user.id,
        after: { email, firstName, lastName, hourlyRate, department: departmentInput || null },
        metadata: { viaImport: 'vas/csv' },
      })

      result.created++
    } catch (e) {
      result.skipped.push({ row: rowNum, reason: e instanceof Error ? e.message : 'Failed to create' })
    }
  }

  if (result.created > 0) {
    revalidatePath('/vas')
    revalidateTag(CACHE_TAGS.vas, 'default')
    revalidateTag(CACHE_TAGS.users, 'default')
  }

  return result
}

export async function updateVAProfile(vaProfileId: string, formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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
    select: { vaaPosition: true, level: true, baseRate: true, hourlyRate: true, preferredWorkHours: true, availabilityStatus: true, hybrid: true, status: true, engagementStatus: true },
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

  const field = statusType === 'GENERAL' ? 'status' : 'engagementStatus'
  const before = await prisma.vAProfile.findUnique({
    where: { id: vaProfileId },
    select: { status: true, engagementStatus: true },
  })
  if (!before) throw new Error('VA profile not found')

  const oldValue = statusType === 'GENERAL' ? before.status : before.engagementStatus

  const effective = effectiveDate ? new Date(effectiveDate) : new Date()
  if (Number.isNaN(effective.getTime())) throw new Error('Invalid effective date')

  await prisma.$transaction([
    prisma.vAProfile.update({ where: { id: vaProfileId }, data: { [field]: newValue } }),
    prisma.vAStatusHistory.create({
      data: {
        vaProfileId,
        statusType,
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

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
}

export async function updateUserProfile(userId: string, formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')
  await updateVAProfile(vaProfileId, formData)
  await updateUserProfile(userId, formData)
}

export async function updateUserProfileFiles(
  userId: string,
  passportPhoto: string | null,
  philhealthPhoto: string | null,
  signedContract: string | null
) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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
