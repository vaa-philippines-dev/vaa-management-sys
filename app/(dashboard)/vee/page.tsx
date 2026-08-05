import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Mail, CircleCheck, CircleX, Clock } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDistanceToNow, format } from 'date-fns'

// Same set as isAdmin in app/(dashboard)/layout.tsx — "stays visible for the
// admin and executive" means exactly that computation, not the broader
// manager set /matching uses.
const VEE_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

const JOB_NAME = 'vee-inbox-check'

// If nothing has run in this long, something on the host is probably down —
// Vee is a separate process (local pm2 or a hosted worker) this app can't
// reach directly, so recency of its own run log is the only signal available.
const STALE_AFTER_MINUTES = 15

const PIPELINE_STEPS = [
  { title: 'Poll Gmail', detail: 'Checks the configured inbox for unread client-request emails on a fixed interval.' },
  { title: 'Summarize', detail: 'Sends each email to Groq to extract client name, requested service, scope, and discount info.' },
  { title: 'Cross-check', detail: "Compares the request against the client's real, current assignment record in this database." },
  { title: 'Notify', detail: 'Sends the result by email and as an Inbox DM — both to the Business Process Manager, and to the discount approver when relevant.' },
]

function StatCard({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-xl font-bold tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

export default async function VeePage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !VEE_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const runs = await cached('vee:runs', [CACHE_TAGS.agent], 10, () =>
    prisma.agentRun.findMany({
      where: { job: JOB_NAME },
      orderBy: { startedAt: 'desc' },
      take: 100,
    })
  )

  // cached() round-trips through JSON — Dates come back as strings.
  const normalized = runs.map((r) => ({
    ...r,
    startedAt: new Date(r.startedAt),
    finishedAt: r.finishedAt ? new Date(r.finishedAt) : null,
  }))

  const lastRun = normalized[0] ?? null
  const isStale = !lastRun || new Date().getTime() - lastRun.startedAt.getTime() > STALE_AFTER_MINUTES * 60 * 1000

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const todaysRuns = normalized.filter((r) => r.startedAt >= startOfToday)
  const emailsToday = todaysRuns.reduce((sum, r) => sum + r.itemsProcessed, 0)
  const notificationsToday = todaysRuns.reduce((sum, r) => sum + r.suggestionsMade, 0)
  const failuresToday = todaysRuns.filter((r) => r.status === 'FAILED').length

  const recentRuns = normalized.slice(0, 20)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vee</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Email intake pipeline — runs as a separate process, monitored here.
          </p>
        </div>
        <Badge variant={isStale ? 'destructive' : 'default'} className="gap-1.5 px-3 py-1 text-xs">
          <span className={`h-1.5 w-1.5 rounded-full ${isStale ? 'bg-destructive' : 'bg-current'}`} />
          {isStale ? 'No recent activity' : 'Active'}
        </Badge>
      </div>

      {isStale && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="pt-4 text-sm text-amber-700 dark:text-amber-400">
            {lastRun
              ? `Last run was ${formatDistanceToNow(lastRun.startedAt, { addSuffix: true })} — expected activity roughly every few minutes. Check that Vee's process (pm2, or its hosted worker) is still running.`
              : "No runs recorded yet. Once Vee's poller starts, its activity will show up here automatically."}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Clock} label="Last run" value={lastRun ? formatDistanceToNow(lastRun.startedAt, { addSuffix: true }) : '—'} />
        <StatCard icon={Mail} label="Emails checked today" value={emailsToday} />
        <StatCard icon={CircleCheck} label="Notifications sent today" value={notificationsToday} />
        <StatCard icon={CircleX} label="Failed runs today" value={failuresToday} />
      </div>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-3">What it does</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {PIPELINE_STEPS.map((step, i) => (
              <div key={step.title} className="flex gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
                  {i + 1}
                </span>
                <div>
                  <p className="text-[13px] font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <h3 className="text-sm font-semibold mb-3">Recent runs</h3>
          {recentRuns.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No runs recorded yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Started</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emails checked</TableHead>
                  <TableHead>Notifications sent</TableHead>
                  <TableHead>Error</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs text-muted-foreground" title={format(run.startedAt, 'PPpp')}>
                      {formatDistanceToNow(run.startedAt, { addSuffix: true })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={run.status === 'SUCCEEDED' ? 'secondary' : run.status === 'FAILED' ? 'destructive' : 'outline'}>
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{run.itemsProcessed}</TableCell>
                    <TableCell className="text-sm">{run.suggestionsMade}</TableCell>
                    <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground" title={run.error ?? ''}>
                      {run.error ?? '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
