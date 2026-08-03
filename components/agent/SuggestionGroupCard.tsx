'use client'

import { ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ExpandableText } from './ExpandableText'
import { AgentSuggestionCard, KIND_LABEL, type SuggestionForCard } from './AgentSuggestionCard'

export type SuggestionGroup = {
  key: string
  label: string
  departmentName: string | null
  platform: string | null
  requestSummary: string
  items: SuggestionForCard[]
}

export function SuggestionGroupCard({
  group,
  canDecide,
  open,
  onToggle,
}: {
  group: SuggestionGroup
  canDecide: boolean
  open: boolean
  onToggle: () => void
}) {
  const kindCounts = group.items.reduce<Record<string, number>>((acc, item) => {
    acc[item.kind] = (acc[item.kind] ?? 0) + 1
    return acc
  }, {})
  const hasUrgent = group.items.some((i) => i.kind === 'STALLED_HANDOFF' || i.kind === 'NO_MATCH_FOUND')

  return (
    <div className={cn('rounded-xl border bg-card transition-colors', hasUrgent && !open && 'border-amber-500/40')}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 rounded-xl p-3.5 text-left transition-colors hover:bg-muted/40"
        aria-expanded={open}
      >
        <ChevronDown
          className={cn('mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')}
        />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold">{group.label}</p>
            {group.departmentName && (
              <Badge variant="outline" className="font-normal">
                {group.departmentName}
              </Badge>
            )}
            {group.platform && <span className="text-[11px] text-muted-foreground">{group.platform}</span>}
          </div>
          <ExpandableText text={group.requestSummary} limit={150} className="text-xs text-muted-foreground" />
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {Object.entries(kindCounts).map(([kind, count]) => (
              <Badge
                key={kind}
                variant={kind === 'STALLED_HANDOFF' || kind === 'NO_MATCH_FOUND' ? 'destructive' : 'secondary'}
                className="text-[10px] font-normal"
              >
                {count} {KIND_LABEL[kind as SuggestionForCard['kind']]}
              </Badge>
            ))}
          </div>
        </div>
      </button>

      {open && (
        <div className="space-y-2 border-t p-3.5">
          {group.items.map((s) => (
            <AgentSuggestionCard key={s.id} suggestion={s} canDecide={canDecide} />
          ))}
        </div>
      )}
    </div>
  )
}
