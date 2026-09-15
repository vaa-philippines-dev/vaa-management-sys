import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PieChart } from 'lucide-react'
import type { HeadcountComposition as Composition, HeadcountBucket } from '@/lib/headcount'

// The composition half of the DMF sheet's "Headcount" tab. Rendered below
// the monthly movement table, and labelled "as of today" because — unlike
// hires and EOCs, which are dated records — none of this is reconstructible
// for a past month without stored snapshots (see lib/headcount.ts).
export function HeadcountComposition({ composition }: { composition: Composition }) {
  const asOf = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(composition.asOf))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Workforce Composition
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {composition.totalVAs} VA records &middot; as of {asOf}, not the selected month
          </p>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <Group title="Engagement" buckets={composition.engagement} />
        <Group title="Active — work pattern" buckets={composition.activePattern} />
        <Group title="Idle" buckets={composition.idle} />
        <Group title="Remaining capacity" buckets={composition.availability} />
        <Group title="Recommended" buckets={composition.recommended} />
      </CardContent>
    </Card>
  )
}

function Group({ title, buckets }: { title: string; buckets: HeadcountBucket[] }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{title}</p>
      <dl className="space-y-1">
        {buckets.map((b) => (
          <div key={b.label} className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="text-muted-foreground">
              {b.label}
              {b.hint && <span className="text-xs text-muted-foreground/60"> ({b.hint})</span>}
            </dt>
            <dd className="font-semibold tabular-nums">{b.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
