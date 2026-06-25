import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { notFound } from 'next/navigation'
import { TaskDetail } from '@/components/tasks/TaskDetail'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      assignedTo: { include: { user: true } },
      assignedBy: true,
    },
  })

  if (!task) notFound()

  if (!isDevMode && user?.role === 'VA' && task.assignedTo.userId !== user.id) {
    return <div className="text-center text-destructive">You do not have access to this task.</div>
  }

  const vas = user?.role === 'MANAGER' || isDevMode
    ? await prisma.vAProfile.findMany({
        include: { user: true },
        orderBy: { user: { name: 'asc' } },
      })
    : []

  const serialized = {
    ...task,
    dueDate: task.dueDate?.toISOString() ?? null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  }

  return <TaskDetail task={serialized} vas={vas} currentUserRole={user?.role ?? 'MANAGER'} />
}
