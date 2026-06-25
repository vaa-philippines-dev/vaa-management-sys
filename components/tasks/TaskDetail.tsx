'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TaskStatusBadge, TaskPriorityBadge } from './TaskStatusBadge'
import { updateTaskStatus, updateTask, deleteTask } from '@/app/(dashboard)/tasks/actions'
import { useRouter } from 'next/navigation'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { ExternalLink, Trash2, Upload } from 'lucide-react'

type TaskDetailType = {
  id: string
  title: string
  description: string | null
  priority: string
  status: string
  dueDate: string | null
  googleDriveFolder: string | null
  department: string | null
  createdAt: string
  updatedAt: string
  assignedTo: { id: string; user: { name: string | null; email: string } }
  assignedBy: { id: string; name: string | null; email: string }
}

export function TaskDetail({
  task,
  vas,
  currentUserRole,
}: {
  task: TaskDetailType
  vas: Array<{ id: string; user: { name: string | null; email: string } }>
  currentUserRole: string
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const isManager = currentUserRole === 'MANAGER'

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/tasks/${task.id}/upload`, {
        method: 'POST',
        body: formData,
      })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    await deleteTask(task.id)
    router.push('/tasks')
  }

  const handleStatusChange = (value: string) => {
    updateTaskStatus(task.id, value)
  }

  const handleReassign = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const fd = new FormData()
    fd.set('assignedToId', formData.get('assignedToId') as string)
    fd.set('title', task.title)
    fd.set('priority', task.priority)
    fd.set('status', task.status)
    await updateTask(task.id, fd)
    router.refresh()
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold">{task.title}</h2>
        <div className="flex gap-2">
          {isManager && (
            <AlertDialog>
              <AlertDialogTrigger render={<Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>} />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Task?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <TaskStatusBadge status={task.status} />
        <TaskPriorityBadge priority={task.priority} />
        {task.department && <Badge variant="outline">{task.department}</Badge>}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <span className="text-muted-foreground">Assigned to</span>
            <span>{task.assignedTo.user.name ?? task.assignedTo.user.email}</span>
            <span className="text-muted-foreground">Assigned by</span>
            <span>{task.assignedBy.name ?? task.assignedBy.email}</span>
            <span className="text-muted-foreground">Due date</span>
            <span>{task.dueDate ? format(new Date(task.dueDate), 'MMM dd, yyyy') : 'No due date'}</span>
            <span className="text-muted-foreground">Created</span>
            <span>{format(new Date(task.createdAt), 'MMM dd, yyyy')}</span>
          </div>

          {task.description && (
            <div>
              <span className="text-muted-foreground block mb-1">Description</span>
              <p className="whitespace-pre-wrap">{task.description}</p>
            </div>
          )}

          {task.googleDriveFolder && (
            <div>
              <span className="text-muted-foreground block mb-1">Drive Folder</span>
              <a
                href={task.googleDriveFolder}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Open in Google Drive
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Select defaultValue={task.status} onValueChange={(value: string | null) => { if (value) handleStatusChange(value); }}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'].map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isManager && (
            <>
              <form onSubmit={handleReassign} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Reassign:</span>
                <select
                  name="assignedToId"
                  className="flex h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={task.assignedTo.id}
                >
                  {vas.map((va) => (
                    <option key={va.id} value={va.id}>
                      {va.user.name ?? va.user.email}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline">
                  Update
                </Button>
              </form>

              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Upload file:</span>
                <label className="cursor-pointer inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-sm font-medium hover:bg-muted">
                  <Upload className="h-3 w-3" />
                  {uploading ? 'Uploading...' : 'Choose File'}
                  <Input
                    type="file"
                    className="hidden"
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
