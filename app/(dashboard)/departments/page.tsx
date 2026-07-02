import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import Link from 'next/link'
import {
  Building2,
  Users,
  Briefcase,
  Shield,
  ArrowRight,
  LayoutDashboard,
  ChevronRight,
  UsersRound,
  BriefcaseBusiness,
  Crown,
  Cog,
  Megaphone,
  ShoppingCart,
  PenTool,
  HeadphonesIcon,
  ClipboardCheck,
  Wallet,
  TrendingUp,
} from 'lucide-react'

const LEVEL_META: Record<string, {
  label: string
  shortLabel: string
  color: string
  textColor: string
  ringColor: string
  icon: React.ComponentType<{ className?: string }>
  description: string
}> = {
  EXECUTIVE: {
    label: 'Executive Leadership',
    shortLabel: 'Executive',
    color: 'bg-purple-500/10',
    textColor: 'text-purple-700',
    ringColor: 'ring-purple-500/20',
    icon: Crown,
    description: 'Top-level organizational leadership and decision makers',
  },
  MANAGEMENT: {
    label: 'Management & Internal Operations',
    shortLabel: 'Management',
    color: 'bg-blue-500/10',
    textColor: 'text-blue-700',
    ringColor: 'ring-blue-500/20',
    icon: Cog,
    description: 'Internal teams that keep the company running',
  },
  SERVICE: {
    label: 'Client-Facing Services',
    shortLabel: 'Service',
    color: 'bg-emerald-500/10',
    textColor: 'text-emerald-700',
    ringColor: 'ring-emerald-500/20',
    icon: BriefcaseBusiness,
    description: 'Departments that deliver work to clients via Virtual Assistants',
  },
}

const DEPARTMENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CEO: Crown,
  COO: TrendingUp,
  CFO: Wallet,
  'Human Resources': UsersRound,
  'Business Operations': Cog,
  Administrator: Shield,
  'Customer Success': HeadphonesIcon,
  'Amazon Department': ShoppingCart,
  'Wholesale Department': ShoppingCart,
  'PPC Department': TrendingUp,
  'Social Media Department': Megaphone,
  'Executive Assistant Department': ClipboardCheck,
  'Walmart Department': ShoppingCart,
  'Creatives Department': PenTool,
  default: Building2,
}

type Dept = {
  id: string
  name: string
  shortName: string | null
  acronym: string | null
  level: 'EXECUTIVE' | 'MANAGEMENT' | 'SERVICE' | null
  parentId: string | null
  childrenCount: number
  membershipsCount: number
  clientsCount: number
}

export default async function DepartmentsPage() {
  const user = await getCurrentUser()
  if (!user) return null

  const departments = await cached('depts:directory', [CACHE_TAGS.departments], 60, () =>
    prisma.department.findMany({
      where: { status: 'ACTIVE' },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { children: true, memberships: true, clients: true } },
      },
    })
  )

  const levelOrder = ['EXECUTIVE', 'MANAGEMENT', 'SERVICE'] as const
  const byLevel: Record<string, Dept[]> = {}
  for (const lvl of levelOrder) byLevel[lvl] = []
  for (const d of departments) {
    const lvl = (d.level ?? 'SERVICE') as string
    byLevel[lvl].push({
      id: d.id,
      name: d.name,
      shortName: d.shortName,
      acronym: d.acronym,
      level: d.level,
      parentId: d.parentId,
      childrenCount: d._count.children,
      membershipsCount: d._count.memberships,
      clientsCount: d._count.clients,
    })
  }

  const parents = byLevel['SERVICE'].filter((d) => d.parentId && d.childrenCount > 0)
  const childrenByParent = new Map<string, Dept[]>()
  for (const c of byLevel['SERVICE'].filter((d) => d.parentId)) {
    const arr = childrenByParent.get(c.parentId!) ?? []
    arr.push(c)
    childrenByParent.set(c.parentId!, arr)
  }
  const allTeamCount = byLevel['SERVICE'].filter((d) => d.parentId).length
  const totalDepartments = departments.length
  const totalMembers = departments.reduce((s, d) => s + d._count.memberships, 0)
  const totalClients = departments.reduce((s, d) => s + d._count.clients, 0)
  const isAdmin = ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.systemRole)

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Departments</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin
              ? 'Choose a department to view its scoped dashboard'
              : 'Browse the teams and departments in the company'}
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {totalDepartments} departments
          </span>
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {allTeamCount} teams
          </span>
          <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
            {totalMembers} members
          </span>
        </div>
      </div>

      {totalDepartments === 0 && (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground mb-4">
            No departments configured yet. Create departments from the Admin Panel.
          </p>
          {isAdmin && (
            <Link
              href="/admin/departments"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Go to Admin Panel
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      )}

      {levelOrder.map((lvl) => {
        const meta = LEVEL_META[lvl]
        if (!meta) return null
        const items = byLevel[lvl]
        if (items.length === 0) return null
        const levelParents = lvl === 'SERVICE' ? parents : items.filter((d) => !d.parentId)
        const levelLeaves = lvl === 'SERVICE' ? [] : items.filter((d) => d.parentId)
        const LevelIcon = meta.icon
        return (
          <section key={lvl} className="space-y-3">
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${meta.color} ${meta.textColor}`}>
                <LevelIcon className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold leading-none">{meta.label}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{meta.description}</p>
              </div>
              <span className={`ml-auto text-[10px] font-medium px-2 py-0.5 rounded-full ${meta.color} ${meta.textColor}`}>
                {items.length}
              </span>
            </div>

            {lvl === 'SERVICE' ? (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {levelParents.map((d) => (
                  <ServiceDepartmentCard
                    key={d.id}
                    dept={d}
                    teams={childrenByParent.get(d.id) ?? []}
                    accent={meta.textColor}
                  />
                ))}
                {levelLeaves.map((d) => (
                  <LeafDepartmentCard key={d.id} dept={d} />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {levelParents.map((d) => (
                  <LeafDepartmentCard key={d.id} dept={d} />
                ))}
                {levelLeaves.map((d) => (
                  <LeafDepartmentCard key={d.id} dept={d} />
                ))}
              </div>
            )}
          </section>
        )
      })}

      <div className="grid gap-3 sm:grid-cols-3 pt-2 border-t">
        <Link
          href="/dashboard"
          className="group rounded-xl border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm"
        >
          <div className="flex items-center justify-between mb-1.5">
            <LayoutDashboard className="h-4 w-4 text-primary" />
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-sm font-medium">Full Dashboard</p>
          <p className="text-xs text-muted-foreground mt-0.5">All departments at a glance</p>
        </Link>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <Users className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-700">{totalMembers}</span>
          </div>
          <p className="text-sm font-medium">Active Members</p>
          <p className="text-xs text-muted-foreground mt-0.5">Across all departments</p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <Briefcase className="h-4 w-4 text-emerald-600" />
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-700">{totalClients}</span>
          </div>
          <p className="text-sm font-medium">Active Clients</p>
          <p className="text-xs text-muted-foreground mt-0.5">Across all service departments</p>
        </div>
      </div>
    </div>
  )
}

function ServiceDepartmentCard({
  dept,
  teams,
  accent,
}: {
  dept: Dept
  teams: Dept[]
  accent: string
}) {
  const Icon = DEPARTMENT_ICONS[dept.name] ?? DEPARTMENT_ICONS.default
  return (
    <div className="rounded-xl border bg-card overflow-hidden hover:shadow-md hover:border-primary/30 transition-all">
      <Link href={`/dashboard?dept=${dept.id}`} className="block p-4 group">
        <div className="flex items-start gap-3">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 ${accent}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                {dept.name}
              </h4>
              {dept.acronym && (
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {dept.acronym}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {dept.membershipsCount}
              </span>
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {dept.clientsCount}
              </span>
              <span className="flex items-center gap-1">
                <UsersRound className="h-3 w-3" />
                {teams.length} teams
              </span>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </Link>
      {teams.length > 0 && (
        <div className="border-t bg-muted/30 px-4 py-2.5 space-y-1">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
            Teams ({teams.length})
          </p>
          {teams.map((t) => (
            <Link
              key={t.id}
              href={`/dashboard?dept=${t.id}`}
              className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-background transition-colors group/team"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" />
                <span className="truncate">{t.name}</span>
              </div>
              {t.acronym && (
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">{t.acronym}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function LeafDepartmentCard({ dept }: { dept: Dept }) {
  const Icon = DEPARTMENT_ICONS[dept.name] ?? DEPARTMENT_ICONS.default
  return (
    <Link
      href={`/dashboard?dept=${dept.id}`}
      className="group rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
              {dept.name}
            </h4>
            {dept.acronym && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                {dept.acronym}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
            {dept.membershipsCount > 0 && (
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {dept.membershipsCount} members
              </span>
            )}
            {dept.clientsCount > 0 && (
              <span className="flex items-center gap-1">
                <Briefcase className="h-3 w-3" />
                {dept.clientsCount} clients
              </span>
            )}
            {dept.childrenCount > 0 && (
              <span className="flex items-center gap-1">
                <UsersRound className="h-3 w-3" />
                {dept.childrenCount} sub
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
    </Link>
  )
}
