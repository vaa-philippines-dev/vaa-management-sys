'use client'

import { X, Briefcase, Building2, Mail } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  EXECUTIVE: 'Executive',
  DEPT_MANAGER: 'Dept Manager',
  TEAM_LEADER: 'Team Leader',
  OPERATIONS_MANAGER: 'Operations Manager',
  STAFF: 'Staff',
  VA: 'Virtual Assistant',
}

export type ProfilePanelUser = {
  id: string
  firstName: string
  lastName: string
  email?: string
  avatarUrl?: string | null
  systemRole?: string
  departmentName?: string | null
  positionTitle?: string | null
}

export function UserProfilePanel({ user, onClose }: { user: ProfilePanelUser; onClose: () => void }) {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ')
  const initial = (user.firstName || 'U')[0].toUpperCase()

  return (
    <div
      className={cn(
        'flex h-full w-72 shrink-0 flex-col border-l bg-card',
        'animate-in slide-in-from-right-8 fade-in-0 duration-200'
      )}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">Profile</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close profile panel"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 border-b px-4 py-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-lg font-semibold text-primary-foreground overflow-hidden">
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatarUrl} alt={displayName} className="h-full w-full object-cover" />
          ) : (
            initial
          )}
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">{displayName}</p>
          {user.email && <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-4 py-4 text-xs">
        {user.systemRole && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-3.5 w-3.5 shrink-0" />
            <span>{ROLE_LABELS[user.systemRole] ?? user.systemRole}</span>
          </div>
        )}
        {user.departmentName && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span>
              {user.departmentName}
              {user.positionTitle ? ` · ${user.positionTitle}` : ''}
            </span>
          </div>
        )}
        {user.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
        )}
      </div>
    </div>
  )
}
