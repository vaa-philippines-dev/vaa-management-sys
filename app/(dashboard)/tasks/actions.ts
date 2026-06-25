'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { createDriveFolder } from '@/lib/google/drive'
import { syncTasksToSheet } from '@/lib/google/sheets'
import type { TaskStatus, TaskPriority } from '@/src/generated/prisma/enums'

export async function createTask(formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MANAGER') throw new Error('Unauthorized')

  const title = formData.get('title') as string
  const description = (formData.get('description') as string) || null
  const priority = (formData.get('priority') as string) || 'MEDIUM'
  const dueDate = (formData.get('dueDate') as string) || null
  const assignedToId = formData.get('assignedToId') as string

  const vaProfile = await prisma.vAProfile.findUnique({
    where: { id: assignedToId },
    include: { user: true },
  })
  if (!vaProfile) throw new Error('VA not found')

  const task = await prisma.task.create({
    data: {
      title,
      description,
      priority: priority as TaskPriority,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignedToId,
      assignedById: user.id,
      department: vaProfile.user.department,
    },
  })

  try {
    const folderUrl = await createDriveFolder(`Task - ${title}`)
    await prisma.task.update({
      where: { id: task.id },
      data: { googleDriveFolder: folderUrl },
    })
  } catch (e) {
    console.error('Drive folder creation failed, continuing:', e)
  }

  syncTasksToSheet().catch((e) => console.error('Sheet sync failed:', e))

  revalidatePath('/tasks')
  redirect('/tasks')
}

export async function updateTaskStatus(taskId: string, status: string) {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: { assignedTo: true },
  })
  if (!task) throw new Error('Task not found')

  if (user.role === 'VA' && task.assignedTo.userId !== user.id) {
    throw new Error('Not your task')
  }

  await prisma.task.update({
    where: { id: taskId },
    data: { status: status as TaskStatus },
  })

  syncTasksToSheet().catch((e) => console.error('Sheet sync failed:', e))
  revalidatePath('/tasks')
}

export async function updateTask(taskId: string, formData: FormData) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MANAGER') throw new Error('Unauthorized')

  const data: Record<string, unknown> = {}
  const title = formData.get('title')
  if (title) data.title = title
  const description = formData.get('description')
  if (description) data.description = description
  const priority = formData.get('priority')
  if (priority) data.priority = priority
  const status = formData.get('status')
  if (status) data.status = status
  const dueDate = formData.get('dueDate')
  if (dueDate) data.dueDate = new Date(dueDate as string)
  const assignedToId = formData.get('assignedToId')
  if (assignedToId) {
    const vaProfile = await prisma.vAProfile.findUnique({
      where: { id: assignedToId as string },
      include: { user: true },
    })
    if (vaProfile) {
      data.assignedToId = assignedToId
      data.department = vaProfile.user.department
    }
  }

  await prisma.task.update({ where: { id: taskId }, data })

  syncTasksToSheet().catch((e) => console.error('Sheet sync failed:', e))
  revalidatePath('/tasks')
}

export async function deleteTask(taskId: string) {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MANAGER') throw new Error('Unauthorized')

  await prisma.task.delete({ where: { id: taskId } })

  syncTasksToSheet().catch((e) => console.error('Sheet sync failed:', e))
  revalidatePath('/tasks')
}
