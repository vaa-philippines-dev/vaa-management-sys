'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole, requireAdminMutator } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { Proficiency, EmploymentStatus } from '@/src/generated/prisma/enums'

export async function createVA(formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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
      startDate: new Date(),
      effectiveDate: new Date(),
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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

      await prisma.employmentRecord.create({
        data: {
          userId: user.id,
          departmentId,
          contractType: 'REGULAR',
          employmentStatus: (engagementStatus as EmploymentStatus | null) ?? 'EMPLOYED',
          startDate: new Date(),
          effectiveDate: new Date(),
          isCurrent: true,
          initiatedBy: actor.id,
        },
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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER')

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

    return created
  })

  revalidatePath(`/vas/${vaProfileId}`)
  revalidateTag(CACHE_TAGS.vas, 'default')
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
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
        data: { status: 'INACTIVE' },
      }),
      prisma.user.update({
        where: { id: va.userId },
        data: { isActive: false, status: 'INACTIVE' },
      }),
      prisma.vAHistory.create({
        data: {
          userId: va.userId,
          eventType: 'STATUS_CHANGE',
          oldValue: va.status,
          newValue: 'INACTIVE',
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
      after: { status: 'INACTIVE' },
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
