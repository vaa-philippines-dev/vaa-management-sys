import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { Database } from 'lucide-react'

const VA_CONNECTIONS_VIEW_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER', 'STAFF']

const PAGE_SIZE = 50

const STATUS_COLORS: Record<string, string> = {
  Started: 'bg-success/10 text-success border-success/20',
  Paused: 'bg-warning/10 text-warning border-warning/20',
  Cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  Terminated: 'bg-destructive/10 text-destructive border-destructive/20',
  Pending: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Accepted: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  Declined: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
}

export default async function VAConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !VA_CONNECTIONS_VIEW_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const status = typeof params.status === 'string' ? params.status : undefined
  const page = Math.max(1, Number(params.page) || 1)

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (q) {
    where.OR = [
      { vaName: { contains: q, mode: 'insensitive' } },
      { clientName: { contains: q, mode: 'insensitive' } },
      { connectionId: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [records, totalCount, statusGroups, lastSynced] = await Promise.all([
    prisma.vAConnectionRecord.findMany({
      where,
      orderBy: { lastSyncedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vAConnectionRecord.count({ where }),
    prisma.vAConnectionRecord.groupBy({ by: ['status'], _count: true, orderBy: { status: 'asc' } }),
    prisma.vAConnectionRecord.findFirst({ orderBy: { lastSyncedAt: 'desc' }, select: { lastSyncedAt: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const buildPageHref = (targetPage: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (status) sp.set('status', status)
    sp.set('page', String(targetPage))
    return `/va-connections?${sp.toString()}`
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Database className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">VA Connections</h2>
            <p className="text-xs text-muted-foreground">
              Mirrored from the manager&apos;s VAConnections sheet · {totalCount} record{totalCount !== 1 ? 's' : ''}
              {lastSynced && ` · last loaded ${new Date(lastSynced.lastSyncedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`}
            </p>
          </div>
        </div>
      </div>

      <p className="text-xs text-muted-foreground bg-muted/50 border rounded-md px-3 py-2">
        Read-only view of the sheet as loaded. These rows aren&apos;t linked to Assignments yet —
        matching a connection to a VA/Client record here is a later phase.
      </p>

      <div className="rounded-lg border bg-card p-3">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterBar
            filters={[
              {
                key: 'status',
                label: 'Status',
                options: statusGroups.map((g) => ({ value: g.status, label: `${g.status} (${g._count})` })),
              },
            ]}
            searchPlaceholder="Search VA, client, or connection ID..."
          />
        </Suspense>
      </div>

      <Card>
        <CardContent className="p-0">
          {records.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No VA Connections loaded yet.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-b bg-muted/50">
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">VA</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Client</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Type</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Hours</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Start</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wider">Connection ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.id} className="border-b">
                    <TableCell className="text-sm font-medium">{r.vaName || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.clientName || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn('text-[10px]', STATUS_COLORS[r.status] ?? '')}>
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.connectionType || '—'}</TableCell>
                    <TableCell className="text-xs">{r.hours || '—'}{r.hoursType ? ` (${r.hoursType})` : ''}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.startDate || r.connectionDate || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono">{r.connectionId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Page {page} of {totalPages}</span>
          <div className="flex gap-2">
            <Link
              href={buildPageHref(Math.max(1, page - 1))}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page <= 1 && 'pointer-events-none opacity-50')}
            >
              Previous
            </Link>
            <Link
              href={buildPageHref(Math.min(totalPages, page + 1))}
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), page >= totalPages && 'pointer-events-none opacity-50')}
            >
              Next
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
