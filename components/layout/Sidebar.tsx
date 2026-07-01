'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  LogOut,
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  Clock,
  UserCog,
  BarChart3,
  ListTodo,
  Shield,
  ClipboardList,
} from 'lucide-react'
import Image from 'next/image'

const managerRoutes = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'VAs', href: '/vas', icon: Users },
  { label: 'Assignments', href: '/assignments', icon: Briefcase },
  { label: 'Work Logs', href: '/work-logs', icon: ListTodo },
  { label: 'Services', href: '/skills', icon: UserCog },
  { label: 'Monthly Report', href: '/reports', icon: BarChart3 },
]

const vaRoutes = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Work Logs', href: '/work-logs', icon: Clock },
  { label: 'My Assignments', href: '/assignments', icon: Briefcase },
]

export function Sidebar({ role = 'MANAGER', isAdmin = false }: { role?: 'MANAGER' | 'VA'; isAdmin?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const routes = role === 'VA' ? vaRoutes : managerRoutes

  const handleLogout = async () => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      await supabase.auth.signOut()
    } catch {
      // Supabase not configured — just redirect
    }
    router.push('/login')
  }

  return (
    <div className="flex h-full w-60 flex-col border-r bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b px-5">
        <Image
          src="/vaalogo.svg"
          alt="VAA Philippines"
          width={32}
          height={32}
          className="shrink-0"
        />
        <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
          VAA Philippines
        </span>
      </div>
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="flex flex-col gap-1">
          {routes.map((route) => {
            const Icon = route.icon
            const isActive =
              route.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(route.href)
            return (
              <Link key={route.href} href={route.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {route.label}
                </Button>
              </Link>
            )
          })}

          {isAdmin && (
            <>
              <div className="my-2 border-t" />
              <Link href="/departments">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 rounded-lg text-sm font-medium transition-colors',
                    pathname === '/departments'
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <Building2 className="h-4 w-4 shrink-0" />
                  Departments
                </Button>
              </Link>
              <Link href="/admin">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith('/admin')
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  Admin Panel
                </Button>
              </Link>
              <Link href="/admin/audit">
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-3 rounded-lg text-sm font-medium transition-colors',
                    pathname.startsWith('/admin/audit')
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
                  )}
                >
                  <ClipboardList className="h-4 w-4 shrink-0" />
                  Audit Log
                </Button>
              </Link>
            </>
          )}
        </nav>
      </ScrollArea>
      <div className="border-t p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 rounded-lg text-sm font-medium text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-destructive transition-colors"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}