import Link from 'next/link'
import { Clock, UserCog, Building2, Wallet, MapPin } from 'lucide-react'

type VADetailPanelProps = {
  statusLabel: string
  statusDotClassName: string
  availabilityLabel: string | null
  weeklyHours: number | null
  managerName: string | null
  managerHref?: string
  departmentName: string | null
  positionTitle: string | null
  hourlyRate: number | null
  location: string | null
}

function DetailRow({
  icon: Icon,
  children,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  href?: string
}) {
  const content = (
    <div className="flex items-center gap-2.5 py-1.5 text-sm text-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="rounded-md -mx-1.5 px-1.5 hover:bg-accent/50 transition-colors">
        {content}
      </Link>
    )
  }
  return content
}

export function VADetailPanel({
  statusLabel,
  statusDotClassName,
  availabilityLabel,
  weeklyHours,
  managerName,
  managerHref,
  departmentName,
  positionTitle,
  hourlyRate,
  location,
}: VADetailPanelProps) {
  return (
    <aside className="w-full lg:w-64 shrink-0 lg:border-l lg:pl-5">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</p>
      <div className="flex flex-col divide-y divide-border/60">
        <div className="flex items-center gap-2.5 py-1.5 text-sm">
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotClassName}`} />
          <span>{statusLabel}</span>
        </div>
        {availabilityLabel && (
          <DetailRow icon={Clock}>
            {availabilityLabel}{weeklyHours != null ? ` · ${weeklyHours}h/wk` : ''}
          </DetailRow>
        )}
        {managerName && (
          <DetailRow icon={UserCog} href={managerHref}>
            {managerName}
          </DetailRow>
        )}
        {departmentName && (
          <DetailRow icon={Building2}>
            {departmentName}{positionTitle ? ` — ${positionTitle}` : ''}
          </DetailRow>
        )}
        {hourlyRate != null && (
          <DetailRow icon={Wallet}>
            ${hourlyRate.toFixed(2)}/hr
          </DetailRow>
        )}
        {location && (
          <DetailRow icon={MapPin}>
            {location}
          </DetailRow>
        )}
      </div>
    </aside>
  )
}
