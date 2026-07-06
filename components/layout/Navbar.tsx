import { getCurrentUser } from '@/lib/auth'
import { ThemeToggle } from './ThemeToggle'

export async function Navbar() {
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-6 backdrop-blur-sm">
      <div />
      <div className="flex items-center gap-3">
        <ThemeToggle />
        {user && (
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium text-foreground">{user.firstName || user.email}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
              {(user.firstName || user.email || 'U')[0].toUpperCase()}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
