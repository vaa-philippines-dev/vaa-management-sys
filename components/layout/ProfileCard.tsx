'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LogOut, Building2, Briefcase } from 'lucide-react'

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  EXECUTIVE: 'Executive',
  DEPT_MANAGER: 'Dept Manager',
  STAFF: 'Staff',
  VA: 'Virtual Assistant',
}

type ProfileCardProps = {
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
  systemRole: string
  departmentName?: string | null
  positionTitle?: string | null
}

export function ProfileCard({
  firstName,
  lastName,
  email,
  avatarUrl,
  systemRole,
  departmentName,
  positionTitle,
}: ProfileCardProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email
  const initial = (firstName || email || 'U')[0].toUpperCase()

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground overflow-hidden transition-transform active:scale-95"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
        ) : (
          initial
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-11 z-40 w-64 rounded-xl border bg-popover text-popover-foreground shadow-lg',
            'animate-in fade-in-0 zoom-in-95 duration-150 origin-top-right'
          )}
        >
          <div className="flex items-center gap-3 px-4 py-3 border-b">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground overflow-hidden">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                initial
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{displayName}</p>
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            </div>
          </div>

          <div className="px-4 py-3 space-y-1.5 border-b text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Briefcase className="h-3 w-3" />
              <span>{ROLE_LABELS[systemRole] ?? systemRole}</span>
            </div>
            {departmentName && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Building2 className="h-3 w-3" />
                <span>
                  {departmentName}
                  {positionTitle ? ` · ${positionTitle}` : ''}
                </span>
              </div>
            )}
          </div>

          <div className="p-1.5">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
