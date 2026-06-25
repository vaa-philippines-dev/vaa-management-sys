import { Badge } from '@/components/ui/badge'

const statusColors: Record<string, string> = {
  BACKLOG: 'bg-gray-500',
  TODO: 'bg-blue-500',
  IN_PROGRESS: 'bg-yellow-500',
  REVIEW: 'bg-purple-500',
  DONE: 'bg-green-500',
  CANCELLED: 'bg-red-500',
}

export function TaskStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={`${statusColors[status] ?? 'bg-gray-500'} text-white`}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

const priorityColors: Record<string, string> = {
  LOW: 'bg-slate-400',
  MEDIUM: 'bg-blue-400',
  HIGH: 'bg-orange-500',
  URGENT: 'bg-red-600',
}

export function TaskPriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge className={`${priorityColors[priority] ?? 'bg-slate-400'} text-white`}>
      {priority}
    </Badge>
  )
}
