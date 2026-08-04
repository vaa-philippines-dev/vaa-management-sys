'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { LogOut, Settings, Building2, Briefcase, Eye, ChevronDown } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/role-labels'
import { setViewAsRole, clearViewAsRole } from '@/app/(dashboard)/_view-as/actions'
import type { ViewAsRole } from '@/lib/auth'

type ViewAsDepartment = { id: string; name: string }

type ProfileCardProps = {
  firstName: string | null
  lastName: string | null
  email: string
  avatarUrl: string | null
  systemRole: string
  departmentName?: string | null
  positionTitle?: string | null
  canViewAs?: boolean
  isViewingAs?: boolean
  viewAsRoleOptions?: readonly string[]
  viewAsDepartments?: ViewAsDepartment[]
  viewAsDepartmentId?: string | null
}

export function ProfileCard({
  firstName,
  lastName,
  email,
  avatarUrl,
  systemRole,
  departmentName,
  positionTitle,
  canViewAs = false,
  isViewingAs = false,
  viewAsRoleOptions = [],
  viewAsDepartments = [],
  viewAsDepartmentId = null,
}: ProfileCardProps) {
  const [open, setOpen] = useState(false)
  const [deptMenuOpen, setDeptMenuOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const closeMenu = () => {
    setOpen(false)
    setDeptMenuOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeMenu()
      }
    }
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMenu()
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

  const handleViewAs = (role: string, departmentId?: string) => {
    closeMenu()
    startTransition(async () => {
      await setViewAsRole(role as ViewAsRole, departmentId)
      router.refresh()
    })
  }

  const handleExitViewAs = () => {
    closeMenu()
    startTransition(async () => {
      await clearViewAsRole()
      router.refresh()
    })
  }

  const viewingDepartmentName = isViewingAs && systemRole === 'DEPT_MANAGER' ? departmentName : null

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? closeMenu() : setOpen(true))}
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
            {isViewingAs && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-amber-500/10 px-2 py-1.5 text-amber-700 dark:text-amber-400">
                <span className="flex items-center gap-1.5">
                  <Eye className="h-3 w-3" />
                  Viewing as {ROLE_LABELS[systemRole] ?? systemRole}
                  {viewingDepartmentName ? ` · ${viewingDepartmentName}` : ''}
                </span>
                <button
                  type="button"
                  onClick={handleExitViewAs}
                  disabled={isPending}
                  className="font-semibold underline decoration-dotted hover:no-underline disabled:opacity-50"
                >
                  Exit
                </button>
              </div>
            )}
          </div>

          {canViewAs && viewAsRoleOptions.length > 0 && (
            <div className="p-1.5 border-b">
              <p className="px-2.5 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                View as
              </p>
              <div className="max-h-56 space-y-0.5 overflow-y-auto">
                {viewAsRoleOptions.map((role) => {
                  // Dept Manager is department-scoped — simulating it without
                  // picking a department renders every department-scoped page
                  // empty, so it expands into a per-department submenu instead
                  // of activating directly.
                  if (role === 'DEPT_MANAGER') {
                    const isActiveRole = isViewingAs && systemRole === role
                    return (
                      <div key={role}>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => setDeptMenuOpen((v) => !v)}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50',
                            isActiveRole && 'bg-muted'
                          )}
                        >
                          <span className="flex items-center gap-2">
                            <Eye className="h-3.5 w-3.5" />
                            {ROLE_LABELS[role] ?? role}
                          </span>
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', deptMenuOpen && 'rotate-180')} />
                        </button>
                        {deptMenuOpen && (
                          <div className="ml-5 mt-0.5 space-y-0.5 border-l pl-2">
                            {viewAsDepartments.length === 0 ? (
                              <p className="px-2 py-1.5 text-[11px] text-muted-foreground">No departments found</p>
                            ) : (
                              viewAsDepartments.map((dept) => (
                                <button
                                  key={dept.id}
                                  type="button"
                                  disabled={isPending}
                                  onClick={() => handleViewAs('DEPT_MANAGER', dept.id)}
                                  className={cn(
                                    'flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50',
                                    isActiveRole && viewAsDepartmentId === dept.id && 'bg-muted'
                                  )}
                                >
                                  {dept.name}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    )
                  }

                  return (
                    <button
                      key={role}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleViewAs(role)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium hover:bg-muted transition-colors disabled:opacity-50',
                        isViewingAs && systemRole === role && 'bg-muted'
                      )}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {ROLE_LABELS[role] ?? role}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="p-1.5 border-b">
            <Link
              href="/settings"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-xs font-medium hover:bg-muted transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Settings
            </Link>
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
