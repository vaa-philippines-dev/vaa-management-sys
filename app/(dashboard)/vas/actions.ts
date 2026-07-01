'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function createVA(formData: FormData) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

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

export async function updateVAProfile(vaProfileId: string, formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

  const data: Record<string, any> = {}
  const allowedFields = [
    'vaaPosition', 'level', 'baseRate', 'hourlyRate', 'notes',
    'preferredWorkHours', 'availableSchedule', 'hybrid', 'isActive', 'availabilityStatus',
    'contractLink', 'folder201Link', 'file201Link', 'vaClientFileLink',
    'healthCheckFileLink', 'portfolioUrl', 'vaProfileLink', 'payoutSummaryLink', 'dept201FolderLink',
  ]

  for (const field of allowedFields) {
    const value = formData.get(field)
    if (value !== null) {
      if (field === 'hybrid' || field === 'isActive') {
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
    select: { vaaPosition: true, level: true, baseRate: true, hourlyRate: true, preferredWorkHours: true, availabilityStatus: true, hybrid: true, isActive: true },
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

export async function updateUserProfile(userId: string, formData: FormData) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

  const data: Record<string, any> = {}
  const userData: Record<string, any> = {}
  const allowedFields = [
    'firstName', 'lastName', 'gender', 'birthDate', 'nonCelebrant',
    'whatsappNumber', 'gcashNumber', 'phone',
    'barangay', 'cityMunicipality', 'province', 'zipCode', 'landmark', 'address',
    'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
    'facebookUrl', 'facebookName', 'linkedinUrl',
    'payoneerAccount', 'personalEmail',
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
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')
  await updateVAProfile(vaProfileId, formData)
  await updateUserProfile(userId, formData)
}

export async function updateUserProfileFiles(
  userId: string,
  passportPhoto: string | null,
  philhealthPhoto: string | null,
  signedContract: string | null
) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

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
