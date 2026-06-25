'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { LayoutDashboard, ListTodo, Users, LogOut } from 'lucide-react'

const routes = [
  { label: 'Tasks', href: '/tasks', icon: ListTodo },
  { label: 'VAs', href: '/vas', icon: Users },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

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
    <div className="flex h-full w-56 flex-col border-r bg-sidebar">
      <div className="flex h-14 items-center border-b px-4 font-semibold">
        <LayoutDashboard className="mr-2 h-5 w-5" />
        VA Manager
      </div>
      <ScrollArea className="flex-1 p-2">
        <nav className="flex flex-col gap-1">
          {routes.map((route) => {
            const Icon = route.icon
            const isActive = pathname.startsWith(route.href)
            return (
              <Link key={route.href} href={route.href}>
                <Button
                  variant="ghost"
                  className={cn(
                    'w-full justify-start gap-2',
                    isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {route.label}
                </Button>
              </Link>
            )
          })}
        </nav>
      </ScrollArea>
      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
