import { getCurrentUser } from '@/lib/auth'
import { ThemeToggle } from './ThemeToggle'
import { ProfileCard } from './ProfileCard'
import { CommandPalette } from './CommandPalette'
import { NotificationBell } from './NotificationBell'

export async function Navbar() {
  const user = await getCurrentUser()
  const primaryMembership = user?.memberships.find((m) => m.isPrimary) ?? user?.memberships[0]
  const isAdmin = user ? ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE'].includes(user.systemRole) : false
  const isVA = user?.userType === 'VIRTUAL_ASSISTANT'

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex flex-1 items-center">
        <CommandPalette isAdmin={isAdmin} isVA={isVA} />
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
            departmentName={primaryMembership?.department?.name}
            positionTitle={primaryMembership?.position?.title}
          />
        )}
      </div>
    </header>
  )
}
