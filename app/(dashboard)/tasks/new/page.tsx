import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { TaskForm } from '@/components/tasks/TaskForm'
import { createTask } from './actions'

export default async function NewTaskPage() {
  const user = await getCurrentUser()

  const vas = await prisma.vAProfile.findMany({
    include: { user: true },
    orderBy: { user: { name: 'asc' } },
  })

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-2xl font-semibold">New Task</h2>
      <TaskForm action={createTask} vas={vas} />
    </div>
  )
}
