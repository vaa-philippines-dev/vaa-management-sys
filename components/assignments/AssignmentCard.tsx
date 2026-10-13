import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { cn } from '@/lib/utils'

export type AssignmentRow = {
  id: string
  type: 'REGULAR' | 'PROJECT'
  status: string
  clientId: string
  clientName: string
  clientCompany: string | null
  departmentName: string | null
  vaProfileId: string
  vaName: string
  agreedHours: number
  loggedHours: number
  // Epoch ms, for sorting; the labels are what's displayed.
  startTime: number
  startLabel: string
  endLabel: string | null
  // An additional-hours add-on to another engagement (parentAssignmentId set).
  isAdditional: boolean
}

type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

export const ASSIGNMENT_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  PAUSED: 'Paused',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

export const ASSIGNMENT_STATUS_TONE: Record<string, Tone> = {
  ACTIVE: 'success',
  PAUSED: 'warning',
  ON_HOLD: 'warning',
  COMPLETED: 'neutral',
  CANCELLED: 'destructive',
}

const TONE_BORDER: Record<Tone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  info: 'border-l-info',
  neutral: 'border-l-muted-foreground/30',
}

export function AssignmentStatus({ status }: { status: string }) {
  return (
    <StatusIndicator tone={ASSIGNMENT_STATUS_TONE[status] ?? 'neutral'}>
      {ASSIGNMENT_STATUS_LABEL[status] ?? status}
    </StatusIndicator>
  )
}

export function AssignmentTypeBadge({ type }: { type: AssignmentRow['type'] }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] py-0 px-1.5',
        type === 'PROJECT' ? 'border-info/30 bg-info/10 text-info' : 'text-muted-foreground'
      )}
    >
      {type === 'PROJECT' ? 'Project' : 'Regular'}
    </Badge>
  )
}

export function AssignmentCard({ a, showVA = true }: { a: AssignmentRow; showVA?: boolean }) {
  return (
    <Link href={`/assignments/${a.id}`} className="block h-full">
      <Card
        className={cn(
          'group h-full cursor-pointer border-l-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5',
          TONE_BORDER[ASSIGNMENT_STATUS_TONE[a.status] ?? 'neutral']
        )}
      >
        <CardContent className="flex h-full flex-col gap-2 px-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{a.clientName}</p>
              <p className="text-xs text-muted-foreground truncate">
                {showVA ? a.vaName : a.clientCompany ?? a.departmentName ?? '—'}
                {a.isAdditional && <span className="ml-1.5 text-[10px] font-medium text-primary">+ Additional hours</span>}
              </p>
            </div>
            <AssignmentTypeBadge type={a.type} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <AssignmentStatus status={a.status} />
            {a.departmentName && <span className="text-[10px] text-muted-foreground/70 truncate">{a.departmentName}</span>}
          </div>
          <div className="mt-auto space-y-1 border-t pt-2 text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="text-muted-foreground/70">Agreed </span>
                <span className="font-medium tabular-nums">{a.agreedHours}h</span>
              </span>
              <span>
                <span className="text-muted-foreground/70">Logged </span>
                <span className="font-medium tabular-nums">{a.loggedHours.toFixed(1)}h</span>
              </span>
            </div>
            <p className="truncate text-muted-foreground">
              {a.startLabel} → {a.endLabel ?? <span className="text-muted-foreground/60">Ongoing</span>}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
