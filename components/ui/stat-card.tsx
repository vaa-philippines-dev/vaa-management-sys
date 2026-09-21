import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// Shared "icon + label + big number" tile, used across the dashboard, VA
// Masterlist, and VA Availability scorecards. `href` is optional — a tile
// with no natural filter to deep-link to (e.g. "On Hold") just renders as a
// plain, non-interactive card instead of a dead/misleading link.
export function StatCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  href?: string
}) {
  const card = (
    <Card className={href ? 'card-hover group/stat bg-gradient-to-br from-card to-muted/40' : 'bg-gradient-to-br from-card to-muted/40'}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-muted ${href ? 'transition-transform group-hover/stat:scale-110' : ''}`}>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
      </CardContent>
    </Card>
  )

  return href ? <Link href={href}>{card}</Link> : card
}
