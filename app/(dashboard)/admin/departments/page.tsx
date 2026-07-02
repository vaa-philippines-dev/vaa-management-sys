import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Building2,
  Users,
  Briefcase,
  CheckCircle2,
  Shield,
  ChevronRight,
} from 'lucide-react'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'
import { DeptTree } from '@/components/admin/DeptTree'

const adminViewRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

const LEVEL_META: Record<string, { label: string; color: string; textColor: string; bg: string }> = {
  EXECUTIVE: { label: 'Executive', color: 'bg-purple-500', textColor: 'text-purple-700', bg: 'bg-purple-500/10' },
  MANAGEMENT: { label: 'Management', color: 'bg-blue-500', textColor: 'text-blue-700', bg: 'bg-blue-500/10' },
  SERVICE: { label: 'Service', color: 'bg-emerald-500', textColor: 'text-emerald-700', bg: 'bg-emerald-500/10' },
}

export default async function AdminDepartmentsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !adminViewRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canEdit = canMutate(currentUser)

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Departments</h2>
          <p className="text-xs text-muted-foreground">
            {canEdit
              ? 'Manage the full organizational hierarchy — executives, management, and client-facing service teams'
              : 'View the full organizational hierarchy — read-only access for Executive role'}
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
            View Only
          </span>
        )}
      </div>

      <Suspense fallback={<Skeleton className="h-32 rounded-xl" />}>
        <StatsHeader />
      </Suspense>

      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <DepartmentTree canEdit={canEdit} />
      </Suspense>
    </div>
  )
}

async function StatsHeader() {
  const stats = await cached('admin:deptStats', [CACHE_TAGS.departments, CACHE_TAGS.admin], 60, async () => {
    const [total, active, byLevel, topLevel, withChildren] = await Promise.all([
      prisma.department.count(),
      prisma.department.count({ where: { status: 'ACTIVE' } }),
      prisma.department.groupBy({ by: ['level'], _count: true }),
      prisma.department.count({ where: { isParent: true } }),
      prisma.department.count({ where: { children: { some: {} } } }),
    ])
    return { total, active, byLevel, topLevel, withChildren }
  })

  const byLevelMap = Object.fromEntries(stats.byLevel.map((b) => [b.level ?? 'OTHER', b._count]))

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-7">
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</span>
          <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.total}</p>
        <p className="text-[10px] text-muted-foreground mt-1">All departments</p>
      </div>
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Active</span>
          <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
        </div>
        <p className="text-2xl font-bold leading-none text-green-700">{stats.active}</p>
        <p className="text-[10px] text-muted-foreground mt-1">In use</p>
      </div>
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Top-Level</span>
          <Shield className="h-3.5 w-3.5 text-amber-600" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.topLevel}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Parent depts</p>
      </div>
      <div className="rounded-xl border bg-card p-3.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">With Teams</span>
          <Users className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <p className="text-2xl font-bold leading-none">{stats.withChildren}</p>
        <p className="text-[10px] text-muted-foreground mt-1">Sub-depts</p>
      </div>
      {(['EXECUTIVE', 'MANAGEMENT', 'SERVICE'] as const).map((lvl) => {
        const meta = LEVEL_META[lvl]
        return (
          <div key={lvl} className="rounded-xl border bg-card p-3.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{meta.label}</span>
              <div className={`h-3.5 w-3.5 rounded-full ${meta.color}`} />
            </div>
            <p className={`text-2xl font-bold leading-none ${meta.textColor}`}>{byLevelMap[lvl] ?? 0}</p>
            <p className="text-[10px] text-muted-foreground mt-1">Level {lvl.toLowerCase()}</p>
          </div>
        )
      })}
    </div>
  )
}

async function DepartmentTree({ canEdit }: { canEdit: boolean }) {
  type DeptNode = {
    id: string
    name: string
    shortName: string | null
    acronym: string | null
    level: 'EXECUTIVE' | 'MANAGEMENT' | 'SERVICE' | null
    status: 'ACTIVE' | 'MERGED' | 'SPLIT' | 'INACTIVE'
    parentId: string | null
    mergedIntoName: string | null
    splitFromName: string | null
    childrenCount: number
    membershipsCount: number
    clientsCount: number
    isLevel: boolean
    children: DeptNode[]
  }

  function mapDept(d: typeof allDepts[number]): DeptNode {
    return {
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      acronym: d.acronym,
      level: d.level,
      status: d.status,
      parentId: d.parentId,
      mergedIntoName: d.mergedInto?.name ?? null,
      splitFromName: d.splitFrom?.name ?? null,
      childrenCount: d._count.children,
      membershipsCount: d._count.memberships,
      clientsCount: d._count.clients,
      isLevel: LEVEL_RECORD_NAMES.includes(d.name) && d.level === d.name,
      children: [],
    }
  }

  const [allDepts, allServices, deptSkills] = await Promise.all([
    cached('admin:deptTree', [CACHE_TAGS.departments, CACHE_TAGS.admin], 60, () =>
      prisma.department.findMany({
        orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
        include: {
          parent: { select: { id: true, name: true } },
          mergedInto: { select: { name: true } },
          splitFrom: { select: { name: true } },
          _count: { select: { children: true, memberships: true, clients: true } },
        },
      })
    ),
    cached('admin:allSkills', [CACHE_TAGS.skills], 60, () =>
      prisma.skill.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] })
    ),
    cached('admin:deptSkills', [CACHE_TAGS.departments, CACHE_TAGS.skills], 60, () =>
      prisma.departmentSkill.findMany({ select: { departmentId: true, skillId: true } })
    ),
  ])

  const mapped = allDepts.map(mapDept)
  const byId = new Map<string, DeptNode>()
  for (const d of mapped) byId.set(d.id, d)
  for (const d of mapped) {
    if (d.parentId) {
      const parent = byId.get(d.parentId)
      if (parent) parent.children.push(d)
    }
  }
  const roots = mapped.filter((d) => !d.parentId)

  const services = allServices.map((s) => ({ id: s.id, name: s.name, category: s.category }))

  return <DeptTree departments={roots} services={services} deptSkillMap={deptSkills} canEdit={canEdit} />
}
