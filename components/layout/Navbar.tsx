import { getCurrentUser, getPrimaryDepartment, VIEW_AS_ROLES } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { ThemeToggle } from './ThemeToggle'
import { ProfileCard } from './ProfileCard'
import { CommandPalette } from './CommandPalette'
import { NotificationBell } from './NotificationBell'
import { ViewAsBanner } from './ViewAsBanner'

export async function Navbar() {
  const user = await getCurrentUser()
  const primaryMembership = user?.memberships.find((m) => m.isPrimary) ?? user?.memberships[0]
  const isAdmin = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(user.systemRole) : false
  const isVA = user?.userType === 'VIRTUAL_ASSISTANT'
  const canViewAs = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.realSystemRole) : false

  // Only fetched for admins who can actually use "view as" — powers the per-department
  // Dept Manager picker in ProfileCard.
  const viewAsDepartments = canViewAs
    ? await cached('nav:view-as-departments', [CACHE_TAGS.departments], 600, () =>
        prisma.department.findMany({
          where: { level: 'SERVICE', status: 'ACTIVE' },
          select: { id: true, name: true },
          orderBy: { sortOrder: 'asc' },
        })
      )
    : []

  const primaryDepartment = user ? getPrimaryDepartment(user) : null

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex flex-1 items-center gap-3">
        <CommandPalette isAdmin={isAdmin} isVA={isVA} />
        {user?.isViewingAs && <ViewAsBanner role={user.systemRole} departmentName={user.viewAsDepartment?.name} />}
      </div>
      <div className="flex items-center gap-3">
        {user && <NotificationBell userId={user.id} currentUserMessageColor={user.messageColor} />}
        <ThemeToggle />
        {user && (
          <ProfileCard
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            avatarUrl={user.avatarUrl}
            systemRole={user.systemRole}
            departmentName={primaryDepartment?.name}
            positionTitle={user.viewAsDepartment ? undefined : primaryMembership?.position?.title}
            canViewAs={canViewAs}
            isViewingAs={user.isViewingAs}
            viewAsRoleOptions={VIEW_AS_ROLES}
            viewAsDepartments={viewAsDepartments}
            viewAsDepartmentId={user.viewAsDepartmentId}
          />
        )}
      </div>
    </header>
  )
}
