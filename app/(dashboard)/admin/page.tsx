import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { prisma } from '@/lib/prisma'
import {
  createDepartmentInline,
} from './users/actions'
import {
  Shield,
  Users,
  Building2,
  UserCog,
  BarChart3,
  ArrowRight,
  Activity,
  UserPlus,
  Settings,
  Layers,
  Plus,
} from 'lucide-react'
import { DepartmentCard } from '@/components/admin/DepartmentCard'
import { Skeleton } from '@/components/ui/skeleton'

export default async function AdminPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-sm text-muted-foreground mt-1">
            System administration — manage users, departments, and platform settings
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/users">
            <Button variant="outline" size="sm">
              <UserPlus className="h-4 w-4 mr-2" />
              Manage Users
            </Button>
          </Link>
          <Link href="/departments">
            <Button variant="outline" size="sm">
              <Building2 className="h-4 w-4 mr-2" />
              All Departments
            </Button>
          </Link>
        </div>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsSection />
      </Suspense>

      <Suspense fallback={<DepartmentsSkeleton />}>
        <DepartmentsSection />
      </Suspense>

      <Suspense fallback={<RecentSkeleton />}>
        <RecentUsersSection />
      </Suspense>

      <QuickActionsSection />
    </div>
  )
}

async function StatsSection() {
  const [totalUsers, activeVAs, totalDepartments, roleCounts] = await Promise.all([
    cached('admin:totalUsers', [CACHE_TAGS.users], 60, () => prisma.user.count()),
    cached('admin:activeVAs', [CACHE_TAGS.vas], 60, () => prisma.vAProfile.count({ where: { status: 'ACTIVE' } })),
    cached('admin:totalDepts', [CACHE_TAGS.departments], 600, () => prisma.department.count({ where: { status: 'ACTIVE' } })),
    cached('admin:roleCounts', [CACHE_TAGS.users], 60, () =>
      prisma.user.groupBy({ by: ['systemRole'], _count: true }).then((rows) =>
        ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'STAFF', 'VA'].map((role) => ({
          role,
          count: rows.find((r) => r.systemRole === role)?._count ?? 0,
        }))
      )
    ),
  ])

  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Overview</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalUsers}</p>
            <p className="text-xs text-muted-foreground mt-1">Registered accounts</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active VAs</CardTitle>
            <UserCog className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{activeVAs}</p>
            <p className="text-xs text-muted-foreground mt-1">Virtual assistants</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Departments</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalDepartments}</p>
            <p className="text-xs text-muted-foreground mt-1">Active departments</p>
          </CardContent>
        </Card>
        <Card className="card-hover">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Admin Roles</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">
              {roleCounts.filter((r) => ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(r.role)).reduce((s, r) => s + r.count, 0)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Super & System Admins</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

async function DepartmentsSection() {
  const [departments, roleCounts, totalUsers] = await Promise.all([
    cached('admin:departments', [CACHE_TAGS.departments], 600, () =>
      prisma.department.findMany({
        where: { status: 'ACTIVE', parentId: { not: null } },
        orderBy: { sortOrder: 'asc' },
        include: { _count: { select: { memberships: true, clients: true } } },
      })
    ),
    cached('admin:roleCounts', [CACHE_TAGS.users], 60, () =>
      prisma.user.groupBy({ by: ['systemRole'], _count: true }).then((rows) =>
        ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'STAFF', 'VA'].map((role) => ({
          role,
          count: rows.find((r) => r.systemRole === role)?._count ?? 0,
        }))
      )
    ),
    cached('admin:totalUsers', [CACHE_TAGS.users], 60, () => prisma.user.count()),
  ])

  const departmentIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
    Admin: Shield,
    HR: Users,
    Operations: Layers,
    default: Building2,
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Department Overview
            </CardTitle>
            <Link href="/departments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            {departments.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No departments yet. Create one below.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {departments.map((dept) => {
                  const Icon = departmentIconMap[dept.name] ?? departmentIconMap.default
                  return (
                    <DepartmentCard key={dept.id} dept={dept} icon={<Icon className="h-4 w-4 text-muted-foreground" />} />
                  )
                })}
              </div>
            )}
            <div className="mt-4 pt-4 border-t">
              <form action={createDepartmentInline} className="flex gap-2">
                <input name="name" placeholder="New department name..." className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background" required />
                <input name="description" placeholder="Description (optional)" className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background hidden sm:block" />
                <Button type="submit" size="sm" variant="outline"><Plus className="h-4 w-4 mr-1" />Add</Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />Role Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {roleCounts.map(({ role, count }) => (
              <div key={role} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full" style={{ background: roleColor(role) }} />
                  <span className="text-sm">{role.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: totalUsers > 0 ? `${(count / totalUsers) * 100}%` : '0%', background: roleColor(role) }} />
                  </div>
                  <Badge variant="secondary" className="text-xs w-10 justify-center">{count}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function roleColor(role: string) {
  const colors: Record<string, string> = {
    SUPER_ADMIN: '#dc2626',
    SYSTEM_ADMIN: '#ea580c',
    EXECUTIVE: '#ca8a04',
    DEPT_MANAGER: '#2563eb',
    STAFF: '#7c3aed',
    VA: '#059669',
  }
  return colors[role] ?? '#6b7280'
}

async function RecentUsersSection() {
  const recentUsers = await cached('admin:recentUsers', [CACHE_TAGS.users], 60, () =>
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { memberships: { include: { department: true } } },
    })
  )

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Recent Users</CardTitle>
        <Link href="/admin/users" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">Manage all <ArrowRight className="h-3 w-3" /></Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {recentUsers.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/20 transition-colors">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                  {(u.firstName || 'U')[0].toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{u.firstName} {u.lastName}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {u.memberships.length > 0 && (
                  <Badge variant="outline" className="text-xs">{u.memberships[0].department.name}</Badge>
                )}
                <Badge variant="secondary" className="text-xs" style={{ background: roleColor(u.systemRole) + '20', color: roleColor(u.systemRole) }}>
                  {u.systemRole.replace(/_/g, ' ')}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function QuickActionsSection() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" />Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-4">
        <QuickAction href="/admin/users" icon={UserPlus} label="Manage Users" desc="Roles, memberships, permissions" />
        <QuickAction href="/departments" icon={Building2} label="Department Views" desc="Switch between department dashboards" />
        <QuickAction href="/vas" icon={UserCog} label="VA Workforce" desc="View and manage virtual assistants" />
        <QuickAction href="/reports" icon={BarChart3} label="Reports" desc="Monthly operations overview" />
      </CardContent>
    </Card>
  )
}

function QuickAction({ href, icon: Icon, label, desc }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <Link href={href}>
      <Button variant="outline" className="w-full h-auto justify-start gap-3 p-4 card-hover">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div className="text-left">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{desc}</p>
        </div>
      </Button>
    </Link>
  )
}

function StatsSkeleton() {
  return (
    <div>
      <Skeleton className="h-4 w-20 mb-3" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-5 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-12" />
            <Skeleton className="h-3 w-28" />
          </div>
        ))}
      </div>
    </div>
  )
}

function DepartmentsSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-40" />
        <div className="grid gap-3 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-md" />
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-32" />
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-2 w-2 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-8" />
          </div>
        ))}
      </div>
    </div>
  )
}

function RecentSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3">
      <Skeleton className="h-5 w-32" />
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
          <Skeleton className="h-9 w-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
    </div>
  )
}
