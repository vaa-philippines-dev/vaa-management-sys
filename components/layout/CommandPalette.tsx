'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  Search,
  X,
  LayoutDashboard,
  Building2,
  Users,
  Briefcase,
  ListTodo,
  UserCog,
  BarChart3,
  Clock,
  Shield,
  UserPlus,
  Network,
  ClipboardList,
  History,
  PieChart,
} from 'lucide-react'

type Shortcut = {
  label: string
  description: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  keywords?: string
  adminOnly?: boolean
}

const SHORTCUTS: Shortcut[] = [
  { label: 'Dashboard', description: 'Overview of activity and stats', href: '/dashboard', icon: LayoutDashboard },
  { label: 'VA Roster', description: 'Browse and manage virtual assistants', href: '/vas', icon: Users, keywords: 'va roster team' },
  { label: 'Clients', description: 'View and manage clients', href: '/clients', icon: Building2 },
  { label: 'Assignments', description: 'VA-to-client staffing assignments', href: '/assignments', icon: Briefcase },
  { label: 'Work Logs', description: 'Hours logged against assignments', href: '/work-logs', icon: ListTodo, keywords: 'hours timesheet' },
  { label: 'Services', description: 'Manage department services and skills', href: '/skills', icon: UserCog, keywords: 'skills services' },
  { label: 'Monthly Report', description: 'Monthly utilization and hours report', href: '/reports', icon: BarChart3, keywords: 'report monthly utilization' },
  { label: 'Headcount Report', description: 'Time-sensitive headcount breakdown', href: '/reports/headcount', icon: PieChart, keywords: 'time sensitive reports headcount' },
  { label: 'Departments', description: 'Department structure', href: '/departments', icon: Building2 },
  { label: 'Admin Panel', description: 'Administrative overview', href: '/admin', icon: Shield, adminOnly: true },
  { label: 'Manage Users', description: 'Add, edit, or deactivate users', href: '/admin/users', icon: UserPlus, adminOnly: true },
  { label: 'Manage Departments', description: 'Merge, split, and edit departments', href: '/admin/departments', icon: Network, adminOnly: true },
  { label: 'Audit Log', description: 'System-wide change history', href: '/admin/audit', icon: ClipboardList, adminOnly: true },
  { label: 'History', description: 'VA history events', href: '/admin/history', icon: History, adminOnly: true },
]

const VA_SHORTCUTS: Shortcut[] = [
  { label: 'Dashboard', description: 'Overview of activity and stats', href: '/dashboard', icon: LayoutDashboard },
  { label: 'My Work Logs', description: 'Hours you have logged', href: '/work-logs', icon: Clock, keywords: 'hours timesheet' },
  { label: 'My Assignments', description: 'Clients you are assigned to', href: '/assignments', icon: Briefcase },
]

export function CommandPalette({ isAdmin, isVA }: { isAdmin: boolean; isVA: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  const shortcuts = useMemo(() => {
    const base = isVA ? VA_SHORTCUTS : SHORTCUTS
    return base.filter((s) => !s.adminOnly || isAdmin)
  }, [isAdmin, isVA])

  const results = useMemo(() => {
    if (!query.trim()) return shortcuts
    const q = query.toLowerCase()
    return shortcuts.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.keywords?.toLowerCase().includes(q)
    )
  }, [query, shortcuts])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }, [])

  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [close])

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const handleQueryChange = (value: string) => {
    setQuery(value)
    setActiveIndex(0)
  }

  const navigate = (href: string) => {
    close()
    router.push(href)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[activeIndex]
      if (target) navigate(target.href)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full max-w-xs items-center gap-2 rounded-lg border bg-muted/40 px-3 text-xs text-muted-foreground transition-colors hover:bg-muted/70"
      >
        <Search className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border bg-background px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          Ctrl K
        </kbd>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] animate-in fade-in-0 duration-150" onClick={close} />
          <div className="relative w-full max-w-lg rounded-xl border bg-popover text-popover-foreground shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150 overflow-hidden">
            <div className="flex items-center gap-2 border-b px-3.5">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type to search pages..."
                className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={close}
                aria-label="Close search"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">No matches found</p>
              ) : (
                results.map((s, i) => (
                  <button
                    key={s.href}
                    type="button"
                    onClick={() => navigate(s.href)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                      i === activeIndex ? 'bg-muted' : 'hover:bg-muted/60'
                    )}
                  >
                    <s.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{s.label}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{s.description}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
