import { Briefcase, Building2, Mail, ListChecks } from 'lucide-react'

type ClientDetailPanelProps = {
  statusLabel: string
  statusDotClassName: string
  contactName: string | null
  contactEmail: string | null
  industry: string | null
  activeAssignments: number
}

function DetailRow({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2 py-[7px] text-[12.5px] text-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{children}</span>
    </div>
  )
}

export function ClientDetailPanel({
  statusLabel,
  statusDotClassName,
  contactName,
  contactEmail,
  industry,
  activeAssignments,
}: ClientDetailPanelProps) {
  return (
    <aside className="w-full lg:w-[220px] shrink-0 lg:border-l lg:pl-[18px]">
      <p className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Details</p>
      <div className="flex flex-col">
        <div className="flex items-center gap-2 py-[7px] text-[12.5px]">
          <span className={`h-2 w-2 rounded-full shrink-0 ${statusDotClassName}`} />
          <span>{statusLabel}</span>
        </div>
        {contactName && <DetailRow icon={Building2}>{contactName}</DetailRow>}
        {contactEmail && <DetailRow icon={Mail}>{contactEmail}</DetailRow>}
        {industry && <DetailRow icon={ListChecks}>{industry}</DetailRow>}
        <DetailRow icon={Briefcase}>
          <span className="font-mono">{activeAssignments}</span> active assignment{activeAssignments === 1 ? '' : 's'}
        </DetailRow>
      </div>
    </aside>
  )
}
