'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
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
  ClipboardList,
  UserPlus,
  Network,
  History,
  ChevronDown,
  Star,
  X,
  Ticket,
  MessageSquare,
} from 'lucide-react'
import Image from 'next/image'
import {
  addFavorite,
  removeFavorite,
  setFeaturedFavorite,
} from '@/app/(dashboard)/_sidebar-favorites/actions'
import type { FavoriteColor } from '@/lib/favorites'
import { useSidebarCollapse } from './SidebarCollapseContext'
import { PanelLeftOpen } from 'lucide-react'

const ADMIN_TREE_STORAGE_KEY = 'sidebar-admin-tree-expanded'
const MAX_FAVORITES = 3

type FavoriteRecord = {
  id: string
  href: string
  label: string
  color: FavoriteColor
  isFeatured: boolean
}

const COLOR_SWATCH: Record<FavoriteColor, string> = {
  YELLOW: '#F5C518',
  BLUE: '#2E7BE0',
  RED: '#E5484D',
}

function NavButton({
  href,
  isActive,
  icon: Icon,
  iconColor,
  children,
}: {
  href: string
  isActive: boolean
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>
  iconColor?: string
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
      <Icon
        className={cn('h-3.5 w-3.5 shrink-0', !iconColor && (isActive ? 'opacity-100' : 'opacity-75'))}
        style={iconColor ? { color: iconColor } : undefined}
      />
      {children}
    </Link>
  )
}

function FavoriteStar({
  href,
  label,
  favorite,
  atMax,
  onChanged,
}: {
  href: string
  label: string
  favorite: FavoriteRecord | undefined
  atMax: boolean
  onChanged: (fn: (prev: FavoriteRecord[]) => FavoriteRecord[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [, startTransition] = useTransition()
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const pickColor = (color: FavoriteColor) => {
    setOpen(false)
    onChanged((prev) => {
      const others = prev.filter((f) => f.href !== href)
      return [...others, { id: favorite?.id ?? href, href, label, color, isFeatured: favorite?.isFeatured ?? false }]
    })
    startTransition(() => {
      addFavorite(href, label, color)
    })
  }

  const unfavorite = () => {
    setOpen(false)
    onChanged((prev) => prev.filter((f) => f.href !== href))
    startTransition(() => {
      removeFavorite(href)
    })
  }

  const [hovered, setHovered] = useState(false)
  const showColor = favorite && (hovered || open)

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label={favorite ? 'Edit favorite' : 'Add to favorites'}
        className={cn(
          'flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100',
          open && 'opacity-100'
        )}
      >
        <Star
          className="h-3 w-3"
          style={showColor ? { color: COLOR_SWATCH[favorite!.color], fill: COLOR_SWATCH[favorite!.color] } : undefined}
        />
      </button>

      {open && (
        <div
          ref={popRef}
          className="absolute right-0 top-6 z-50 flex items-center gap-1.5 rounded-lg border border-sidebar-foreground/10 bg-popover px-2 py-1.5 shadow-lg"
        >
          {(['YELLOW', 'BLUE', 'RED'] as const).map((color) => (
            <button
              key={color}
              type="button"
              disabled={!favorite && atMax}
              onClick={() => pickColor(color)}
              aria-label={`Mark favorite ${color.toLowerCase()}`}
              className={cn(
                'h-4 w-4 rounded-full ring-offset-1 transition-transform hover:scale-110 disabled:cursor-not-allowed disabled:opacity-30',
                favorite?.color === color && 'ring-2 ring-sidebar-foreground/40'
              )}
              style={{ backgroundColor: COLOR_SWATCH[color] }}
            />
          ))}
          {favorite && (
            <button
              type="button"
              onClick={unfavorite}
              aria-label="Remove favorite"
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full text-sidebar-foreground/50 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function FeaturedStarButton({ fav, onToggle }: { fav: FavoriteRecord; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false)
  const showColor = fav.isFeatured && hovered

  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={fav.isFeatured ? 'Unset as featured favorite' : 'Set as featured favorite'}
      title={fav.isFeatured ? 'Featured — lands here on login' : 'Set as featured favorite'}
      className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-sidebar-foreground/30 opacity-0 group-hover:opacity-100 hover:text-sidebar-foreground/70"
    >
      <Star
        className="h-3 w-3"
        style={showColor ? { fill: COLOR_SWATCH[fav.color], color: COLOR_SWATCH[fav.color] } : undefined}
      />
    </button>
  )
}

function FavoritableRow({
  href,
  label,
  icon,
  isActive,
  canFavorite,
  favorite,
  atMax,
  onChanged,
}: {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  canFavorite: boolean
  favorite: FavoriteRecord | undefined
  atMax: boolean
  onChanged: (fn: (prev: FavoriteRecord[]) => FavoriteRecord[]) => void
}) {
  return (
    <div className="group flex items-center gap-0.5">
      <div className="flex-1">
        <NavButton href={href} isActive={isActive} icon={icon}>
          {label}
        </NavButton>
      </div>
      {canFavorite && (
        <FavoriteStar href={href} label={label} favorite={favorite} atMax={atMax} onChanged={onChanged} />
      )}
    </div>
  )
}

const managerRoutes = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Inbox', href: '/inbox', icon: MessageSquare },
  { label: 'Clients', href: '/clients', icon: Building2 },
  { label: 'VA Roster', href: '/vas', icon: Users },
  { label: 'Assignments', href: '/assignments', icon: Briefcase },
  { label: 'Work Logs', href: '/work-logs', icon: ListTodo },
  { label: 'Services', href: '/skills', icon: UserCog },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
  { label: 'Monthly Report', href: '/reports', icon: BarChart3 },
]

const vaRoutes = [
  { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Inbox', href: '/inbox', icon: MessageSquare },
  { label: 'My Work Logs', href: '/work-logs', icon: Clock },
  { label: 'My Assignments', href: '/assignments', icon: Briefcase },
  { label: 'Tickets', href: '/tickets', icon: Ticket },
]

const adminRoutes = [
  { label: 'Admin Panel', href: '/admin', icon: LayoutDashboard },
  { label: 'Manage Users', href: '/admin/users', icon: UserPlus },
  { label: 'Manage Departments', href: '/admin/departments', icon: Network },
  { label: 'Departments', href: '/departments', icon: Building2 },
  { label: 'Audit Log', href: '/admin/audit', icon: ClipboardList },
  { label: 'History', href: '/admin/history', icon: History },
]

export function Sidebar({
  role = 'MANAGER',
  isAdmin = false,
  initialFavorites = [],
}: {
  role?: 'MANAGER' | 'VA'
  isAdmin?: boolean
  initialFavorites?: FavoriteRecord[]
}) {
  const pathname = usePathname()
  const routes = role === 'VA' ? vaRoutes : managerRoutes
  const canFavorite = role === 'MANAGER'
  const { collapsed, setCollapsed } = useSidebarCollapse()

  useEffect(() => {
    setCollapsed(pathname.startsWith('/inbox'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run when entering/leaving /inbox, not on setCollapsed identity
  }, [pathname])

  const [favorites, setFavorites] = useState<FavoriteRecord[]>(initialFavorites)
  const [, startTransition] = useTransition()
  const atMax = favorites.length >= MAX_FAVORITES

  const [adminTreeExpanded, setAdminTreeExpanded] = useState(true)

  useEffect(() => {
    const stored = window.localStorage.getItem(ADMIN_TREE_STORAGE_KEY)
    if (stored === '0') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring persisted collapse state after mount, unavoidable since localStorage isn't available during SSR
      setAdminTreeExpanded(false)
    }
  }, [])

  const toggleAdminTree = () => {
    setAdminTreeExpanded((prev) => {
      const next = !prev
      window.localStorage.setItem(ADMIN_TREE_STORAGE_KEY, next ? '1' : '0')
      return next
    })
  }

  const toggleFeatured = (href: string) => {
    const fav = favorites.find((f) => f.href === href)
    const nowFeatured = !fav?.isFeatured
    setFavorites((prev) => prev.map((f) => ({ ...f, isFeatured: f.href === href ? nowFeatured : false })))
    startTransition(() => {
      setFeaturedFavorite(nowFeatured ? href : null)
    })
  }

  const allRoutes = [...routes, ...(isAdmin ? adminRoutes : [])]
  const isRouteActive = (href: string) =>
    href === '/dashboard' ? pathname === '/dashboard' : pathname === href || pathname.startsWith(href + '/')
  const isFavorited = (href: string) => favorites.some((f) => f.href === href)
  // Suppress the highlight on the main/admin-tree copy of a row once it's also shown in
  // the Favorites list above, so only one row is highlighted at a time.
  const isMainRowActive = (href: string, active: boolean) => active && !isFavorited(href)

  if (collapsed) {
    return (
      <div className="flex h-full w-12 shrink-0 flex-col items-center gap-3 bg-sidebar py-2.5 transition-all duration-200">
        <Image src="/vaalogo.svg" alt="VAA Philippines" width={24} height={24} className="h-6 w-6 shrink-0 object-contain" />
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand sidebar"
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <PanelLeftOpen className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex h-full w-[212px] shrink-0 flex-col bg-sidebar px-2 py-2.5 transition-all duration-200">
      <div className="flex items-center justify-center px-2 pb-3">
        <Image src="/vaalogo.svg" alt="VAA Philippines" className="w-28 h-auto shrink-0" />
      </div>
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-px pr-1">
          {routes.map((route) => (
            <FavoritableRow
              key={route.href}
              href={route.href}
              label={route.label}
              icon={route.icon}
              isActive={isMainRowActive(route.href, isRouteActive(route.href))}
              canFavorite={canFavorite}
              favorite={favorites.find((f) => f.href === route.href)}
              atMax={atMax}
              onChanged={setFavorites}
            />
          ))}

          {isAdmin && (
            <>
              <p className="px-2 pt-3.5 pb-1 text-[10.5px] tracking-wide text-sidebar-foreground/60">Admin</p>
              <div className="group flex items-center gap-0.5">
                <div className="flex-1">
                  <NavButton href="/admin" isActive={isMainRowActive('/admin', pathname === '/admin')} icon={LayoutDashboard}>
                    Admin Panel
                  </NavButton>
                </div>
                {canFavorite && (
                  <FavoriteStar
                    href="/admin"
                    label="Admin Panel"
                    favorite={favorites.find((f) => f.href === '/admin')}
                    atMax={atMax}
                    onChanged={setFavorites}
                  />
                )}
                <button
                  type="button"
                  onClick={toggleAdminTree}
                  aria-expanded={adminTreeExpanded}
                  aria-label={adminTreeExpanded ? 'Collapse admin panel links' : 'Expand admin panel links'}
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
                >
                  <ChevronDown className={cn('h-3 w-3 transition-transform', !adminTreeExpanded && '-rotate-90')} />
                </button>
              </div>

              {adminTreeExpanded && (
                <div className="relative ml-[13px] flex flex-col gap-px border-l border-sidebar-foreground/15 pl-3">
                  <FavoritableRow
                    href="/admin/users"
                    label="Manage Users"
                    icon={UserPlus}
                    isActive={isMainRowActive('/admin/users', isRouteActive('/admin/users'))}
                    canFavorite={canFavorite}
                    favorite={favorites.find((f) => f.href === '/admin/users')}
                    atMax={atMax}
                    onChanged={setFavorites}
                  />
                  <FavoritableRow
                    href="/admin/departments"
                    label="Manage Departments"
                    icon={Network}
                    isActive={isMainRowActive('/admin/departments', isRouteActive('/admin/departments'))}
                    canFavorite={canFavorite}
                    favorite={favorites.find((f) => f.href === '/admin/departments')}
                    atMax={atMax}
                    onChanged={setFavorites}
                  />
                </div>
              )}

              <FavoritableRow
                href="/departments"
                label="Departments"
                icon={Building2}
                isActive={isMainRowActive('/departments', pathname === '/departments')}
                canFavorite={canFavorite}
                favorite={favorites.find((f) => f.href === '/departments')}
                atMax={atMax}
                onChanged={setFavorites}
              />
              <FavoritableRow
                href="/admin/audit"
                label="Audit Log"
                icon={ClipboardList}
                isActive={isMainRowActive('/admin/audit', isRouteActive('/admin/audit'))}
                canFavorite={canFavorite}
                favorite={favorites.find((f) => f.href === '/admin/audit')}
                atMax={atMax}
                onChanged={setFavorites}
              />
              <FavoritableRow
                href="/admin/history"
                label="History"
                icon={History}
                isActive={isMainRowActive('/admin/history', isRouteActive('/admin/history'))}
                canFavorite={canFavorite}
                favorite={favorites.find((f) => f.href === '/admin/history')}
                atMax={atMax}
                onChanged={setFavorites}
              />
            </>
          )}

          {canFavorite && favorites.length > 0 && (
            <>
              <p className="px-2 pt-3.5 pb-1 text-[10.5px] tracking-wide text-sidebar-foreground/60">Favorites</p>
              {favorites.map((fav) => {
                const route = allRoutes.find((r) => r.href === fav.href)
                return (
                  <div key={fav.href} className="group flex items-center gap-0.5">
                    <div className="flex-1">
                      <NavButton
                        href={fav.href}
                        isActive={isRouteActive(fav.href)}
                        icon={route?.icon ?? Star}
                        iconColor={COLOR_SWATCH[fav.color]}
                      >
                        {fav.label}
                      </NavButton>
                    </div>
                    <FeaturedStarButton fav={fav} onToggle={() => toggleFeatured(fav.href)} />
                  </div>
                )
              })}
            </>
          )}
        </nav>
      </ScrollArea>
    </div>
  )
}
