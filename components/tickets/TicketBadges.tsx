import { Badge } from '@/components/ui/badge'

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OPEN: 'default',
  IN_PROGRESS: 'secondary',
  WAITING_ON_CLIENT: 'outline',
  RESOLVED: 'secondary',
  CLOSED: 'outline',
}

const PRIORITY_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  LOW: 'outline',
  MEDIUM: 'secondary',
  HIGH: 'default',
  URGENT: 'destructive',
}

export function TicketStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={STATUS_VARIANT[status] ?? 'outline'}>
      {status.replace(/_/g, ' ')}
    </Badge>
  )
}

export function TicketPriorityBadge({ priority }: { priority: string }) {
  return <Badge variant={PRIORITY_VARIANT[priority] ?? 'outline'}>{priority}</Badge>
}
