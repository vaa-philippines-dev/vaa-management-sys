'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const WORK_LOG_STAFF_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'STAFF']

export async function createWorkLog(formData: FormData) {
  const user = await requireAuth()

  const assignmentId = formData.get('assignmentId') as string
  const workDate = new Date(formData.get('workDate') as string)
  const hours = Number(formData.get('hours'))
  const description = (formData.get('description') as string) || null

  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
  })

  if (!assignment) throw new Error('Assignment not found')

  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  if (isVA) {
    if (assignment.vaProfileId !== user.vaProfile?.id) {
      throw new Error('Forbidden')
    }
  } else if (!WORK_LOG_STAFF_ROLES.includes(user.systemRole)) {
    throw new Error('Forbidden')
  }

  const workLog = await prisma.workLog.create({
    data: {
      assignmentId,
      vaProfileId: assignment.vaProfileId,
      workDate,
      hours,
      description,
    },
  })

  await logAudit({
    actorId: user.id,
    action: 'CREATE',
    entityType: 'WorkLog',
    entityId: workLog.id,
    after: { assignmentId, vaProfileId: assignment.vaProfileId, workDate: workDate.toISOString(), hours, description },
  })

  revalidatePath('/dashboard')
  revalidateTag(CACHE_TAGS.worklogs, 'default')
  revalidatePath('/work-logs')
  revalidateTag(CACHE_TAGS.worklogs, 'default')
  revalidatePath(`/assignments/${assignmentId}`)
  revalidateTag(CACHE_TAGS.assignments, 'default')
  redirect('/work-logs')
}