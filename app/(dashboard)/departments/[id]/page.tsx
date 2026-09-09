import { prisma } from '@/lib/prisma'
import { getCurrentUser, isDepartmentUnrestricted, getManagedDepartmentIds } from '@/lib/auth'
import { getDepartmentStructure } from '@/lib/structure'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StructureCard } from '@/components/departments/StructureCard'
import { ArrowLeft, Crown, Cog, ShieldHalf, LayoutDashboard, UsersRound } from 'lucide-react'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

export default async function DepartmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const department = await cached(`dept:detail:${id}`, [CACHE_TAGS.departments], 60, () =>
    prisma.department.findUnique({
      where: { id },
      select: { id: true, name: true, shortName: true, acronym: true, level: true, status: true, parentId: true },
    })
  )

  // Excludes the 3 protected root "Level records" (Executive/Management/
  // Service) the same way departments/page.tsx does — they have no parentId.
  if (!department || department.status !== 'ACTIVE' || department.parentId === null) notFound()

  const readUnrestricted = isDepartmentUnrestricted(user) || user.systemRole === 'EXECUTIVE'
  if (!readUnrestricted) {
    if (user.userType === 'VIRTUAL_ASSISTANT') {
      const isMember = await prisma.departmentMembership.findFirst({
        where: { userId: user.id, departmentId: id, endedAt: null },
        select: { id: true },
      })
      if (!isMember) notFound()
    } else if (!getManagedDepartmentIds(user).includes(id)) {
      notFound()
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in-0 duration-300">
      <div className="flex items-center gap-3">
        <Link href="/departments">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight">{department.name}</h2>
            {department.acronym && <Badge variant="outline">{department.acronym}</Badge>}
          </div>
          <p className="text-sm text-muted-foreground mt-1">Department structure and leadership</p>
        </div>
        <Link href={`/dashboard?dept=${department.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" />
            Open dashboard
          </Button>
        </Link>
      </div>

      <Suspense fallback={<StructureSkeleton />}>
        <StructureSection departmentId={department.id} />
      </Suspense>
    </div>
  )
}

async function StructureSection({ departmentId }: { departmentId: string }) {
  const structure = await getDepartmentStructure(departmentId)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <StructureCard label="Department Manager" people={structure.deptManagers} icon={Crown} />
        <StructureCard label="Operations Manager" people={structure.opsManagers} icon={Cog} />
        <StructureCard label="Department Head" people={structure.head ? [structure.head] : []} icon={ShieldHalf} />
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/20">
          <UsersRound className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold">Team Leaders ({structure.teamLeaders.length})</p>
        </div>
        {structure.teamLeaders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
            <UsersRound className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No teams with an assigned leader yet.</p>
          </div>
        ) : (
          <div className="divide-y">
            {structure.teamLeaders.map((leader) => (
              <div key={leader.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                  {(leader.firstName[0] ?? '') + (leader.lastName[0] ?? '')}
                </span>
                <span className="text-sm font-medium flex-1 truncate">
                  {leader.firstName} {leader.lastName}
                </span>
                <Badge variant="outline" className="text-[10px] gap-1">
                  {leader.slot === 'LEADER' ? <Crown className="h-2.5 w-2.5" /> : <ShieldHalf className="h-2.5 w-2.5" />}
                  {leader.slot === 'LEADER' ? 'Leader' : 'Temp Leader'}
                </Badge>
                <div className="flex flex-wrap gap-1 justify-end">
                  {leader.teams.map((t) => (
                    <Link key={t.id} href={`/teams/${t.id}`}>
                      <Badge variant="secondary" className="text-[10px]">
                        {t.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StructureSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
      <Skeleton className="h-32 rounded-lg" />
    </div>
  )
}
