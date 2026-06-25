import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { TaskDataGrid } from '@/components/tasks/TaskDataGrid'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export default async function TasksPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const tasks = user
    ? await prisma.task.findMany({
        where:
          user.role === 'VA'
            ? { assignedTo: { userId: user.id } }
            : user.department
              ? { department: user.department }
              : undefined,
        include: {
          assignedTo: { include: { user: true } },
          assignedBy: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    : await prisma.task.findMany({
        include: {
          assignedTo: { include: { user: true } },
          assignedBy: true,
        },
        orderBy: { createdAt: 'desc' },
      })

  const serialized = tasks.map((t) => ({
    ...t,
    dueDate: t.dueDate?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">Tasks</h2>
        {(user?.role === 'MANAGER' || isDevMode) && (
          <Link href="/tasks/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Task
            </Button>
          </Link>
        )}
      </div>
      <TaskDataGrid tasks={serialized} currentUserRole={user?.role ?? 'MANAGER'} />
    </div>
  )
}
