'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireRole } from '@/lib/auth'

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
  redirect(`/vas/${user.vaProfile!.id}`)
}

export async function updateVAProfile(vaProfileId: string, formData: FormData) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

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

  await prisma.vAProfile.update({ where: { id: vaProfileId }, data })
  revalidatePath(`/vas/${vaProfileId}`)
  revalidatePath('/vas')
}

export async function updateUserProfile(userId: string, formData: FormData) {
  await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER')

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

  if (Object.keys(userData).length > 0) {
    await prisma.user.update({ where: { id: userId }, data: userData })
  }

  if (Object.keys(data).length > 0) {
    await prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
  }

  revalidatePath(`/vas/${userId}`)
  revalidatePath('/vas')
}
