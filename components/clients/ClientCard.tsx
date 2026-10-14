import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { UserRoundX } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CLIENT_PLATFORM_META, CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE, clientCompanyName, clientDisplayName, type StatusTone } from '@/lib/clients/display'
import { ClientRequestActions } from '@/components/clients/ClientRequestActions'

export type ClientCardData = {
  id: string
  name: string
  platform: string
  status: string
  onHold: boolean
  contactName: string | null
  industry: string | null
  // Precomputed by the page — see clientNiche() in lib/clients/display.ts.
  category: string | null
  niche: string | null
  requiredSkills: string[]
  // Every assignment on the request (any status) vs. the VAs working it now.
  assignmentCount: number
  // Active / paused / on hold — these block cancelling the request.
  openAssignmentCount: number
  activeVAs: { id: string; name: string }[]
  // When the request was added to the app, preformatted by the page (Manila time).
  dateAdded: string
}

const TONE_BORDER: Record<StatusTone, string> = {
  success: 'border-l-success',
  warning: 'border-l-warning',
  destructive: 'border-l-destructive',
  info: 'border-l-info',
  neutral: 'border-l-muted-foreground/30',
}

export function clientStatusTone(c: Pick<ClientCardData, 'onHold' | 'status'>): StatusTone {
  return c.onHold ? 'warning' : (CLIENT_STATUS_TONE[c.status] ?? 'neutral')
}

export function clientStatusLabel(c: Pick<ClientCardData, 'onHold' | 'status'>): string {
  return c.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[c.status] ?? c.status)
}

export function vaInitials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase() || '?'
}

// Stacked initials for the VAs on a request, capped so a big account doesn't
// blow out the card. Names stay available on hover.
export function ActiveVAStack({ vas, max = 3 }: { vas: ClientCardData['activeVAs']; max?: number }) {
  if (vas.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning">
        <UserRoundX className="h-3 w-3" />
        No active VA
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5" title={vas.map((v) => v.name).join(', ')}>
      <span className="flex -space-x-1.5">
        {vas.slice(0, max).map((v) => (
          <span
            key={v.id}
            className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-2 ring-card"
          >
            {vaInitials(v.name)}
          </span>
        ))}
        {vas.length > max && (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-muted-foreground ring-2 ring-card">
            +{vas.length - max}
          </span>
        )}
      </span>
      <span className="text-[10px] text-muted-foreground">
        {vas.length} active VA{vas.length === 1 ? '' : 's'}
      </span>
    </span>
  )
}

export function ClientCard({ c, canManage = false }: { c: ClientCardData; canManage?: boolean }) {
  const tone = clientStatusTone(c)
  const subtitle = clientCompanyName(c) || [c.category, c.niche].filter(Boolean).join(' · ')
  return (
    // The actions menu sits beside the link, not inside it — a button nested
    // in an <a> is invalid and every click on it would navigate.
    <div className="relative h-full">
      <Link href={`/clients/${c.id}`} className="block h-full">
        <Card
          className={cn(
            'group h-full cursor-pointer border-l-4 py-3 transition-all hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30',
            TONE_BORDER[tone]
          )}
        >
          <CardContent className="flex h-full flex-col gap-2 px-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate group-hover:text-primary transition-colors">{clientDisplayName(c)}</p>
                <p className="text-xs text-muted-foreground truncate">{subtitle || '—'}</p>
              </div>
              <Badge
                variant="outline"
                className={`text-[10px] py-0 px-1.5 shrink-0 ${CLIENT_PLATFORM_META[c.platform]?.color ?? ''}`}
              >
                {CLIENT_PLATFORM_META[c.platform]?.label ?? c.platform}
              </Badge>
            </div>

            <div className="flex items-center justify-between gap-2">
              <StatusIndicator tone={tone}>{clientStatusLabel(c)}</StatusIndicator>
              <span className="text-[10px] text-muted-foreground/70">Added {c.dateAdded}</span>
            </div>

            {c.requiredSkills.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {c.requiredSkills.slice(0, 3).map((s) => (
                  <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                ))}
                {c.requiredSkills.length > 3 && (
                  <span className="text-[10px] text-muted-foreground/70" title={c.requiredSkills.slice(3).join(', ')}>
                    +{c.requiredSkills.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="mt-auto flex items-center justify-between gap-2 border-t pt-2">
              <ActiveVAStack vas={c.activeVAs} />
              <span className={cn('text-[10px] text-muted-foreground/70', canManage && 'mr-6')}>
                {c.assignmentCount} assignment{c.assignmentCount === 1 ? '' : 's'}
              </span>
            </div>
          </CardContent>
        </Card>
      </Link>
      {canManage && (
        <ClientRequestActions
          client={{ id: c.id, name: clientDisplayName(c), status: c.status, assignmentCount: c.assignmentCount, openAssignmentCount: c.openAssignmentCount }}
          className="absolute bottom-2.5 right-2"
        />
      )}
    </div>
  )
}
