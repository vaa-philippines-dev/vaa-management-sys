'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createAssignment(formData: FormData) {
  const clientId = formData.get('clientId') as string
  const vaProfileId = formData.get('vaProfileId') as string
  const type = formData.get('type') as 'REGULAR' | 'PROJECT'
  const agreedHours = Number(formData.get('agreedHours'))
  const startDate = new Date(formData.get('startDate') as string)
  const endDateRaw = formData.get('endDate') as string | null
  const endDate = endDateRaw && type === 'PROJECT' ? new Date(endDateRaw) : null
  const monthlyHoursRaw = formData.get('monthlyHours') as string | null
  const monthlyHours = type === 'REGULAR' && monthlyHoursRaw ? Number(monthlyHoursRaw) : null
  const notes = (formData.get('notes') as string) || null

  const assignment = await prisma.assignment.create({
    data: {
      clientId,
      vaProfileId,
      type,
      agreedHours,
      startDate,
      endDate,
      monthlyHours,
      notes,
    },
  })

  revalidatePath('/assignments')
  redirect(`/assignments/${assignment.id}`)
}

export async function updateAssignmentStatus(id: string, status: string) {
  await prisma.assignment.update({ where: { id }, data: { status: status as any } })
  revalidatePath('/assignments')
  revalidatePath(`/assignments/${id}`)
}