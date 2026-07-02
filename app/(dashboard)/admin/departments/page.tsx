import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Building2, GitMerge, GitBranch, ChevronRight, Plus } from 'lucide-react'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'
import { DeptAdminRow } from '@/components/admin/DeptAdminRow'

const hrgRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN']

const LEVEL_COLORS: Record<string, string> = {
  EXECUTIVE: 'bg-purple-500/15 text-purple-700 border-purple-500/20',
  MANAGEMENT: 'bg-blue-500/15 text-blue-700 border-blue-500/20',
  SERVICE: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20',
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-700 border-green-500/20',
  MERGED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
  SPLIT: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  INACTIVE: 'bg-red-500/15 text-red-600 border-red-500/20',
}

export default async function AdminDepartmentsPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !hrgRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Department Management</h2>
          <p className="text-xs text-muted-foreground">
            Manage all departments, perform merges and splits
          </p>
        </div>
      </div>

      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <DepartmentList />
      </Suspense>
    </div>
  )
}

async function DepartmentList() {
  const departments = await cached('admin:deptList', [CACHE_TAGS.departments, CACHE_TAGS.admin], 60, () =>
    prisma.department.findMany({
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        parent: { select: { id: true, name: true } },
        mergedInto: { select: { id: true, name: true } },
        splitFrom: { select: { id: true, name: true } },
        _count: { select: { children: true, memberships: true, clients: true } },
      },
    })
  )

  const grouped = {
    EXECUTIVE: departments.filter((d) => d.level === 'EXECUTIVE'),
    MANAGEMENT: departments.filter((d) => d.level === 'MANAGEMENT'),
    SERVICE: departments.filter((d) => d.level === 'SERVICE'),
  }

  return (
    <div className="space-y-4">
      {(['EXECUTIVE', 'MANAGEMENT', 'SERVICE'] as const).map((lvl) => (
        <Card key={lvl}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              {lvl.charAt(0) + lvl.slice(1).toLowerCase()} Departments
              <Badge variant="outline" className={`text-xs ml-2 ${LEVEL_COLORS[lvl]}`}>
                {grouped[lvl].length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              {grouped[lvl].length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No {lvl.toLowerCase()} departments yet.</p>
              ) : (
                grouped[lvl].map((dept) => {
                  const isLevel = LEVEL_RECORD_NAMES.includes(dept.name) && dept.level === dept.name
                  return (
                    <DeptAdminRow
                      key={dept.id}
                      dept={{
                        id: dept.id,
                        name: dept.name,
                        shortName: dept.shortName,
                        acronym: dept.acronym,
                        level: dept.level,
                        status: dept.status,
                        parentId: dept.parentId,
                        parentName: dept.parent?.name ?? null,
                        mergedIntoId: dept.mergedIntoId,
                        mergedIntoName: dept.mergedInto?.name ?? null,
                        splitFromId: dept.splitFromId,
                        splitFromName: dept.splitFrom?.name ?? null,
                        childrenCount: dept._count.children,
                        membershipsCount: dept._count.memberships,
                        clientsCount: dept._count.clients,
                        isLevel,
                      }}
                    />
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
