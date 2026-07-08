'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { createUser } from '@/app/(dashboard)/admin/users/actions'
import { Plus, ChevronDown, ChevronUp, UserPlus } from 'lucide-react'

const SYSTEM_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin' },
  { value: 'SYSTEM_ADMIN', label: 'System Admin' },
  { value: 'EXECUTIVE', label: 'Executive' },
  { value: 'DEPT_MANAGER', label: 'Dept Manager' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'VA', label: 'VA' },
]

const USER_TYPES = [
  { value: 'INTERNAL_STAFF', label: 'Internal Staff' },
  { value: 'VIRTUAL_ASSISTANT', label: 'Virtual Assistant' },
]

export function AddUserPanel({ canEdit = true }: { canEdit?: boolean }) {
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState('')
  const [type, setType] = useState('INTERNAL_STAFF')

  if (!canEdit) {
    return (
      <div className="rounded-lg border bg-muted/30 p-3 text-center">
        <p className="text-xs text-muted-foreground">
          Add User panel is hidden in view-only mode
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Add User</span>
        <span className="text-xs text-muted-foreground ml-auto">
          Pre-register by Google email
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t p-4">
          <form action={createUser} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <input
              name="email"
              type="email"
              placeholder="email@company.com"
              className="px-3 py-1.5 text-sm border rounded-md bg-background lg:col-span-2"
              required
            />
            <input
              name="firstName"
              placeholder="First name"
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
              required
            />
            <input
              name="lastName"
              placeholder="Last name"
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
              required
            />
            <select
              name="systemRole"
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
            >
              <option value="" disabled>System role...</option>
              {SYSTEM_ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <select
              name="userType"
              className="px-3 py-1.5 text-sm border rounded-md bg-background"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              {USER_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <Button type="submit" size="sm" className="lg:col-span-2">
              <Plus className="h-4 w-4 mr-1" />
              Add User
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
