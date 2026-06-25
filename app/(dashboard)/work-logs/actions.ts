'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createWorkLog(formData: FormData) {
  const assignmentId = formData.get('assignmentId') as string
  const workDate = new Date(formData.get('workDate') as string)
  const hours = Number(formData.get('hours'))
  const description = (formData.get('description') as string) || null

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) throw new Error('Assignment not found')

  await prisma.workLog.create({
    data: {
      assignmentId,
      vaProfileId: assignment.vaProfileId,
      workDate,
      hours,
      description,
    },
  })

  revalidatePath('/dashboard')
  revalidatePath('/work-logs')
  revalidatePath(`/assignments/${assignmentId}`)
  redirect('/work-logs')
}