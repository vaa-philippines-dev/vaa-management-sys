import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { getTmfTeams, getTmfData } from '@/lib/tmf'
import { TmfBoard } from '@/components/tmf/TmfBoard'
import { StatCard } from '@/components/ui/stat-card'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
  ClipboardList,
  Users,
  Briefcase,
  Clock,
  CalendarClock,
  AlertTriangle,
  PlaneTakeoff,
  GitCompareArrows,
} from 'lucide-react'

// The Team Monitoring File — a Team Leader's file for their own team, the
// counterpart to the department's DMF pages. Scoped to one team at a time;
// see lib/tmf.ts for who can open which team.
export default async function TmfPage({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const teams = await getTmfTeams(user)
  if (teams.length === 0) redirect('/dashboard')

  const { team: requested } = await searchParams
  // An id outside the viewer's own list falls back to their first team
  // rather than erroring — it's the same page either way, just not theirs.
  const team = teams.find((t) => t.id === requested) ?? teams.find((t) => t.canEdit) ?? teams[0]
  const data = await getTmfData(team)
  const s = data.summary

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardList className="h-6 w-6" />
            Team Monitoring
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {team.name} &middot; {team.departmentName}
            {data.team.leaderNames.length > 0 && <> &middot; Led by {data.team.leaderNames.join(', ')}</>}
            {!team.canEdit && <> &middot; read-only</>}
          </p>
        </div>
      </div>

      {teams.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/tmf?team=${t.id}`}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted',
                t.id === team.id && 'border-primary bg-primary/10 text-primary hover:bg-primary/15'
              )}
            >
              {t.name}
              {teams.some((o) => o.departmentId !== t.departmentId) && (
                <span className="text-muted-foreground"> &middot; {t.departmentName}</span>
              )}
            </Link>
          ))}
        </div>
      )}

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 2xl:grid-cols-8 fade-in-stagger">
        <StatCard icon={Users} label="Members" value={s.members} />
        <StatCard icon={Briefcase} label="Engagements" value={s.engagements} />
        <StatCard icon={Clock} label="Booked Hours" value={s.bookedHours} />
        <StatCard icon={Clock} label="Free Hours" value={s.freeHours} />
        <StatCard icon={CalendarClock} label="Check-ins Overdue" value={s.checkInsOverdue} />
        <StatCard icon={AlertTriangle} label="TMF Needs Review" value={s.tmfNeedsReview} />
        <StatCard icon={GitCompareArrows} label="Differs from DMF" value={s.mismatches} />
        <StatCard icon={PlaneTakeoff} label="On Leave Today" value={s.onLeaveToday} />
      </div>

      {data.outsideDepartment.length > 0 && (
        <Card className="flex items-start gap-2 border-warning/40 bg-warning/5 px-3 py-2 text-xs">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-warning" />
          <span>
            {data.outsideDepartment.length === 1 ? '1 team member isn’t' : `${data.outsideDepartment.length} team members aren’t`}{' '}
            in {team.departmentName}&apos;s roster, so they have no TMF row here: {data.outsideDepartment.join(', ')}.
            Ask the department manager to fix their department membership.
          </span>
        </Card>
      )}

      <TmfBoard data={data} />
    </div>
  )
}
