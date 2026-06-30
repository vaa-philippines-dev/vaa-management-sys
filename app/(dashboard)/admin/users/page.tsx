import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Users } from 'lucide-react'
import { redirect } from 'next/navigation'
import { UserCard } from '@/components/admin/UserCard'
import { AddUserPanel } from '@/components/admin/AddUserPanel'

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const [users, departments, positions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        memberships: { include: { department: true, position: true } },
        roleAssignments: { where: { isActive: true }, include: { department: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { positions: true },
    }),
    prisma.position.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-5 w-5 text-muted-foreground" />
          <div>
            <h2 className="text-lg font-bold tracking-tight">Users</h2>
            <p className="text-xs text-muted-foreground">
              {users.length} user{users.length !== 1 ? 's' : ''} registered
            </p>
          </div>
        </div>
      </div>

      <AddUserPanel />

      <div className="space-y-1.5">
        {users.map((u) => (
          <UserCard
            key={u.id}
            user={{
              id: u.id,
              email: u.email,
              firstName: u.firstName,
              lastName: u.lastName,
              systemRole: u.systemRole,
              userType: u.userType,
              isActive: u.isActive,
              memberships: u.memberships.map((m) => ({
                id: m.id,
                department: { id: m.department.id, name: m.department.name },
                position: m.position ? { id: m.position.id, title: m.position.title } : null,
                isPrimary: m.isPrimary,
              })),
              roleAssignments: u.roleAssignments.map((ra) => ({
                id: ra.id,
                module: ra.module,
                role: ra.role,
                department: ra.department ? { id: ra.department.id, name: ra.department.name } : null,
              })),
            }}
            departments={departments.map((d) => ({
              id: d.id,
              name: d.name,
              positions: d.positions.map((p) => ({ id: p.id, title: p.title })),
            }))}
            positions={positions.map((p) => ({ id: p.id, title: p.title }))}
          />
        ))}
      </div>
    </div>
  )
}
