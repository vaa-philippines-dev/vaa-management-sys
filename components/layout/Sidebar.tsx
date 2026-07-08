'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
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
  UserPlus,
  Network,
  History,
} from 'lucide-react'
import Image from 'next/image'

function NavButton({
  href,
  isActive,
  icon: Icon,
  children,
}: {
  href: string
  isActive: boolean
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-[5px] text-[12.5px] font-medium transition-colors',
        isActive
          ? 'bg-sidebar-active text-sidebar-active-foreground'
          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-75')} />
      {children}
    </Link>
  )
}

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
  const routes = role === 'VA' ? vaRoutes : managerRoutes

  return (
    <div className="flex h-full w-[212px] flex-col bg-sidebar px-2 py-2.5">
      <div className="flex items-center gap-2 px-2 pb-3">
        <Image
          src="/vaalogo.svg"
          alt="VAA Philippines"
          width={180}
          height={63}
          className="h-auto w-full shrink-0"
        />
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-px pr-1">
          {routes.map((route) => {
            const isActive =
              route.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(route.href)
            return (
              <NavButton key={route.href} href={route.href} isActive={isActive} icon={route.icon}>
                {route.label}
              </NavButton>
            )
          })}

          {isAdmin && (
            <>
              <p className="px-2 pt-3.5 pb-1 text-[10.5px] tracking-wide text-sidebar-foreground/60">
                Admin
              </p>
              <NavButton href="/admin" isActive={pathname === '/admin'} icon={LayoutDashboard}>
                Admin Panel
              </NavButton>
              <NavButton href="/admin/users" isActive={pathname.startsWith('/admin/users')} icon={UserPlus}>
                Manage Users
              </NavButton>
              <NavButton href="/admin/departments" isActive={pathname.startsWith('/admin/departments')} icon={Network}>
                Manage Departments
              </NavButton>
              <NavButton href="/departments" isActive={pathname === '/departments'} icon={Building2}>
                Departments
              </NavButton>
              <NavButton href="/admin/audit" isActive={pathname.startsWith('/admin/audit')} icon={ClipboardList}>
                Audit Log
              </NavButton>
              <NavButton href="/admin/history" isActive={pathname.startsWith('/admin/history')} icon={History}>
                History
              </NavButton>
            </>
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}