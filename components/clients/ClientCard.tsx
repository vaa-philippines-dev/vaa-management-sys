import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusIndicator } from '@/components/ui/status-indicator'
import { CLIENT_PLATFORM_META, CLIENT_STATUS_LABEL, CLIENT_STATUS_TONE, clientCompanyName, clientDisplayName } from '@/lib/clients/display'

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
  assignments: unknown[]
}

export function ClientCard({ c }: { c: ClientCardData }) {
  return (
    <Link href={`/clients/${c.id}`}>
      <Card className="group cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 py-3">
        <CardContent className="px-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold truncate">{clientDisplayName(c)}</p>
            <Badge
              variant="outline"
              className={`text-[10px] py-0 px-1.5 shrink-0 ${CLIENT_PLATFORM_META[c.platform]?.color ?? ''}`}
            >
              {CLIENT_PLATFORM_META[c.platform]?.label ?? c.platform}
            </Badge>
          </div>

          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="truncate">{clientCompanyName(c) || [c.category, c.niche].filter(Boolean).join(' · ') || '—'}</span>
            <div className="flex items-center gap-1.5 shrink-0">
              <StatusIndicator tone={c.onHold ? 'warning' : (CLIENT_STATUS_TONE[c.status] ?? 'neutral')}>
                {c.onHold ? 'On Hold' : (CLIENT_STATUS_LABEL[c.status] ?? c.status)}
              </StatusIndicator>
            </div>
          </div>

          {c.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-0.5">
              {c.requiredSkills.slice(0, 2).map((s) => (
                <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
              ))}
              {c.requiredSkills.length > 2 && (
                <span className="text-[10px] text-muted-foreground/70">+{c.requiredSkills.length - 2}</span>
              )}
            </div>
          )}

          <p className="text-[10px] text-muted-foreground/70">
            {c.assignments.length} assignment{c.assignments.length === 1 ? '' : 's'}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
