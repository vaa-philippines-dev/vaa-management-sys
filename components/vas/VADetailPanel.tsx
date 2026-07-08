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
    <div className="flex items-center gap-2 py-[7px] text-[12.5px] text-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  )
  if (href) {
    return (
      <Link href={href} className="-mx-1 rounded px-1 hover:bg-accent/50 transition-colors">
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
    <aside className="w-full lg:w-[220px] shrink-0 lg:border-l lg:pl-[18px]">
      <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</p>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 py-[7px] text-[12.5px]">
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
            <span className="font-mono">${hourlyRate.toFixed(2)}/hr</span>
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
