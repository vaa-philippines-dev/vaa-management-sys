import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { Building2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { FilterBar } from '@/components/filters/FilterBar'
import { ClientAdminRow } from '@/components/clients/ClientAdminRow'

const adminViewRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export default async function AdminClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !adminViewRoles.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }
  const canEdit = canMutate(currentUser)

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q : undefined

  const [clients, departments, managers, skills] = await Promise.all([
    prisma.client.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { contactName: { contains: q, mode: 'insensitive' } },
              { contactEmail: { contains: q, mode: 'insensitive' } },
              { industry: { contains: q, mode: 'insensitive' } },
            ],
          }
        : undefined,
      include: {
        department: { select: { id: true, name: true } },
        manager: { select: { id: true, firstName: true, lastName: true, email: true } },
        assignments: { select: { id: true } },
      },
      orderBy: [{ department: { sortOrder: 'asc' } }, { name: 'asc' }],
    }),
    prisma.department.findMany({
      where: { level: 'SERVICE', status: 'ACTIVE' },
      select: { id: true, name: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.user.findMany({
      where: { userType: 'INTERNAL_STAFF' },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: { firstName: 'asc' },
    }),
    prisma.skill.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
  ])

  const skillNames = skills.map((s) => s.name)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold tracking-tight">Clients</h2>
        <p className="text-xs text-muted-foreground">
          {canEdit ? 'Rename, edit, or delete any client across all departments.' : 'Admin-level client management (view-only).'}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-2.5">
        <FilterBar filters={[]} searchPlaceholder="Search clients..." />
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted mb-3">
              <Building2 className="h-6 w-6 text-muted-foreground/60" />
            </div>
            <p className="text-sm font-medium">No clients found</p>
            <p className="text-xs text-muted-foreground mt-1">
              {q ? 'Try a different search.' : 'Clients created across the app will show up here.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="max-h-[calc(100vh-16rem)] overflow-y-auto">
            <Table className="text-xs">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/30">
                  <TableHead className="px-3 py-2.5">Name</TableHead>
                  <TableHead className="px-3 py-2.5 hidden md:table-cell">Department</TableHead>
                  <TableHead className="px-3 py-2.5">Platform</TableHead>
                  <TableHead className="px-3 py-2.5">Status</TableHead>
                  <TableHead className="px-3 py-2.5 hidden lg:table-cell">Contact</TableHead>
                  <TableHead className="px-3 py-2.5 hidden lg:table-cell">Manager</TableHead>
                  <TableHead className="px-3 py-2.5 text-right">Assignments</TableHead>
                  <TableHead className="px-3 py-2.5 w-0"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((c) => (
                  <ClientAdminRow
                    key={c.id}
                    client={{
                      id: c.id,
                      name: c.name,
                      contactName: c.contactName,
                      contactEmail: c.contactEmail,
                      contactPhone: c.contactPhone,
                      platform: c.platform,
                      industry: c.industry,
                      timezone: c.timezone,
                      website: c.website,
                      notes: c.notes,
                      status: c.status,
                      onHold: c.onHold,
                      isActive: c.isActive,
                      managerId: c.managerId,
                      departmentId: c.departmentId,
                      requiredSkills: c.requiredSkills,
                      department: c.department,
                      manager: c.manager,
                      assignmentCount: c.assignments.length,
                    }}
                    departments={departments}
                    managers={managers}
                    skills={skillNames}
                    canEdit={canEdit}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
