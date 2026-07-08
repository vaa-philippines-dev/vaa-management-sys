import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FilterBar } from '@/components/filters/FilterBar'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Shield, Search } from 'lucide-react'

const ACTION_LABELS: Record<string, string> = {
  CREATE: 'Created',
  UPDATE: 'Updated',
  DELETE: 'Deleted',
  STATUS_CHANGE: 'Status Changed',
  TRANSFER: 'Transferred',
  APPROVE: 'Approved',
  REJECT: 'Rejected',
  FILE_UPLOAD: 'File Uploaded',
  SIGN_IN: 'Signed In',
  SIGN_OUT: 'Signed Out',
  MEMBER_ADD: 'Member Added',
  MEMBER_REMOVE: 'Member Removed',
  ROLE_CHANGE: 'Role Changed',
  LOGIN_FAILED: 'Login Failed',
}

const ACTION_COLORS: Record<string, string> = {
  CREATE: 'bg-success/10 text-success border-success/20',
  UPDATE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
  STATUS_CHANGE: 'bg-warning/10 text-warning border-warning/20',
  TRANSFER: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  APPROVE: 'bg-success/10 text-success border-success/20',
  REJECT: 'bg-destructive/10 text-destructive border-destructive/20',
  FILE_UPLOAD: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/20',
  SIGN_IN: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
  SIGN_OUT: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
  MEMBER_ADD: 'bg-teal-500/10 text-teal-600 border-teal-500/20',
  MEMBER_REMOVE: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  ROLE_CHANGE: 'bg-pink-500/10 text-pink-600 border-pink-500/20',
  LOGIN_FAILED: 'bg-destructive/10 text-destructive border-destructive/20',
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined
  const action = typeof params.action === 'string' ? params.action : undefined
  const entity = typeof params.entity === 'string' ? params.entity : undefined

  const where: Record<string, unknown> = {}
  if (action) where.action = action
  if (entity) where.entityType = entity
  if (q) {
    where.actor = {
      OR: [
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ],
    }
  }

  const [logs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        actor: { select: { id: true, email: true, firstName: true, lastName: true } },
        department: { select: { id: true, name: true } },
      },
    }),
    prisma.auditLog.count(),
  ])

  const entityTypes = await prisma.auditLog.groupBy({
    by: ['entityType'],
    _count: true,
    orderBy: { entityType: 'asc' },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">Audit Log</h2>
            <p className="text-xs text-muted-foreground">
              {totalCount} event{totalCount !== 1 ? 's' : ''} recorded · showing latest {Math.min(logs.length, 100)}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3">
        <Suspense fallback={<Skeleton className="h-8 w-full rounded-md" />}>
          <FilterBar
            filters={[
              {
                key: 'action',
                label: 'Action',
                options: Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label })),
              },
              {
                key: 'entity',
                label: 'Entity',
                options: entityTypes.map((e) => ({
                  value: e.entityType,
                  label: e.entityType,
                })),
              },
            ]}
            searchPlaceholder="Search actor name or email..."
          />
        </Suspense>
      </div>

      <Card>
        <CardContent className="p-0">
          {logs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No audit events found.</p>
            </div>
          ) : (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                    {(log.actor.firstName || log.actor.email || 'A')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium">
                        {log.actor.firstName} {log.actor.lastName}
                      </span>
                      <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${ACTION_COLORS[log.action] ?? ''}`}>
                        {ACTION_LABELS[log.action] ?? log.action}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{log.entityType}</span>
                    </div>
                    {log.metadata && typeof log.metadata === 'object' && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(log.metadata as Record<string, unknown>)
                          .filter(([, v]) => v != null && v !== '')
                          .slice(0, 4)
                          .map(([key, value]) => (
                            <span key={key} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                              {key}: {String(value).slice(0, 60)}
                            </span>
                          ))}
                      </div>
                    )}
                    {log.oldValues && (
                      <details className="mt-1">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">
                          Changed fields
                        </summary>
                        <div className="mt-1 grid grid-cols-2 gap-1 text-[10px]">
                          <div className="bg-destructive/10 p-1.5 rounded">
                            <span className="font-medium text-destructive">Before:</span>
                            <pre className="text-destructive mt-0.5 whitespace-pre-wrap">{JSON.stringify(log.oldValues, null, 1)}</pre>
                          </div>
                          <div className="bg-success/10 p-1.5 rounded">
                            <span className="font-medium text-success">After:</span>
                            <pre className="text-success mt-0.5 whitespace-pre-wrap">{JSON.stringify(log.newValues, null, 1)}</pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
