import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { GitMerge, ArrowLeft, AlertCircle } from 'lucide-react'
import { MergeWizard } from '@/components/admin/MergeWizard'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN']

export default async function MergePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const currentUser = await getCurrentUser()
  if (!currentUser || !hrgRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const source = await prisma.department.findUnique({ where: { id } })
  if (!source) notFound()
  if (source.status !== 'ACTIVE' || LEVEL_RECORD_NAMES.includes(source.name)) {
    return (
      <div className="space-y-4">
        <Link href="/admin/departments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
          <ArrowLeft className="h-3 w-3" /> Back to departments
        </Link>
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <AlertCircle className="h-8 w-8 text-warning mx-auto" />
            <p className="text-sm font-medium">Cannot merge this department</p>
            <p className="text-xs text-muted-foreground">
              {LEVEL_RECORD_NAMES.includes(source.name)
                ? 'System Level records cannot be merged.'
                : `This department has status "${source.status}". Only ACTIVE departments can be merged.`}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const eligibleTargets = await cached('admin:mergeTargets', [CACHE_TAGS.departments], 60, () =>
    prisma.department.findMany({
      where: {
        status: 'ACTIVE',
        level: source.level,
        id: { not: id },
        name: { notIn: LEVEL_RECORD_NAMES },
      },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, shortName: true, acronym: true, level: true, _count: { select: { memberships: true, clients: true } } },
    })
  )

  return (
    <div className="space-y-4 max-w-4xl">
      <Link href="/admin/departments" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 w-fit">
        <ArrowLeft className="h-3 w-3" /> Back to departments
      </Link>

      <div className="flex items-center gap-3">
        <GitMerge className="h-5 w-5 text-muted-foreground" />
        <div>
          <h2 className="text-lg font-bold tracking-tight">Merge Department</h2>
          <p className="text-xs text-muted-foreground">
            Combine <span className="font-semibold text-foreground">{source.name}</span> into another {source.level} department. All memberships, clients, and sub-departments will be moved automatically.
          </p>
        </div>
      </div>

      <MergeWizard
        source={{
          id: source.id,
          name: source.name,
          shortName: source.shortName,
          acronym: source.acronym,
          level: source.level,
        }}
        targets={eligibleTargets.map((t) => ({
          id: t.id,
          name: t.name,
          shortName: t.shortName,
          acronym: t.acronym,
          level: t.level,
          membershipsCount: t._count.memberships,
          clientsCount: t._count.clients,
        }))}
      />
    </div>
  )
}
