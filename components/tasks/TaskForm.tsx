'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormStatus } from 'react-dom'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving...' : label}
    </Button>
  )
}

export function TaskForm({
  action,
  vas,
  task,
}: {
  action: (formData: FormData) => Promise<void>
  vas: Array<{ id: string; user: { name: string | null; email: string } }>
  task?: {
    id: string
    title: string
    description: string | null
    priority: string
    status: string
    dueDate: string | null
    assignedToId: string
  }
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          name="title"
          defaultValue={task?.title ?? ''}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <textarea
          id="description"
          name="description"
          className="min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          defaultValue={task?.description ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="assignedToId">Assign to VA</Label>
        <select
          id="assignedToId"
          name="assignedToId"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          defaultValue={task?.assignedToId ?? ''}
          required
        >
          <option value="">Select VA...</option>
          {vas.map((va) => (
            <option key={va.id} value={va.id}>
              {va.user.name ?? va.user.email}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="priority">Priority</Label>
        <select
          id="priority"
          name="priority"
          className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
          defaultValue={task?.priority ?? 'MEDIUM'}
        >
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="dueDate">Due Date</Label>
        <Input
          id="dueDate"
          name="dueDate"
          type="date"
          defaultValue={task?.dueDate?.split('T')[0] ?? ''}
        />
      </div>

      <SubmitButton label={task ? 'Update Task' : 'Create Task'} />
    </form>
  )
}
