import { Badge } from '@/components/ui/badge'
import { OFFBOARDING_WORKFLOW_LABELS, OFFBOARDING_TYPE_LABELS } from '@/lib/offboarding'

const WORKFLOW_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  COMPLETED: 'secondary',
  CANCELLED: 'outline',
}

export function OffboardingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={WORKFLOW_VARIANT[status] ?? 'default'}>
      {OFFBOARDING_WORKFLOW_LABELS[status] ?? status.replace(/_/g, ' ')}
    </Badge>
  )
}

export function OffboardingTypeBadge({ type }: { type: string }) {
  return <Badge variant="outline">{OFFBOARDING_TYPE_LABELS[type] ?? type.replace(/_/g, ' ')}</Badge>
}
