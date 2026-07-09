'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import {
  toggleUserActive,
  removeDepartmentMembership,
  revokeTemporaryRole,
  updateUserNameByForm,
  updateUserRoleByForm,
  updateUserTypeByForm,
  assignDeptByForm,
  assignTempRoleByForm,
  deleteUser,
} from '@/app/(dashboard)/admin/users/actions'
import { UserRowCheckbox } from '@/components/admin/UserRowCheckbox'
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Power,
  PowerOff,
  Loader2,
} from 'lucide-react'

const CONFIRM_WORD = 'CONFIRM'

type Membership = {
  id: string
  department: { id: string; name: string }
  position: { id: string; title: string } | null
  isPrimary: boolean
}

type RoleAssignment = {
  id: string
  module: string
  role: string
  department: { id: string; name: string } | null
}

type Department = { id: string; name: string; positions: { id: string; title: string }[] }
type Position = { id: string; title: string }

type User = {
  id: string
  email: string
  firstName: string
  lastName: string
  systemRole: string
  userType: string
  isActive: boolean
  onHold?: boolean
  memberships: Membership[]
  roleAssignments: RoleAssignment[]
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  SYSTEM_ADMIN: 'System Admin',
  EXECUTIVE: 'Executive',
  DEPT_MANAGER: 'Dept Manager',
  STAFF: 'Staff',
  VA: 'VA',
}

const TYPE_LABELS: Record<string, string> = {
  INTERNAL_STAFF: 'Internal',
  VIRTUAL_ASSISTANT: 'VA',
}

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-500/10 text-red-600 border-red-500/20',
  SYSTEM_ADMIN: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  EXECUTIVE: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
  DEPT_MANAGER: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  STAFF: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
  VA: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
}

const systemRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'STAFF', 'VA']
const userTypes = ['INTERNAL_STAFF', 'VIRTUAL_ASSISTANT']
const tempRoles = ['CONTRIBUTOR', 'VIEWER', 'APPROVER']
const modules = ['clients', 'vas', 'assignments', 'work-logs', 'skills', 'reports', 'admin']

export function UserCard({
  user,
  departments,
  positions,
  canEdit = true,
}: {
  user: User
  departments: Department[]
  positions: Position[]
  canEdit?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteUser(user.id)
      toast.success(`Permanently deleted ${user.firstName} ${user.lastName}`)
      setDeleteModalOpen(false)
      setConfirmText('')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete user')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card group/card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-3 hover:bg-accent/30 transition-colors text-left"
      >
        <span onClick={(e) => e.stopPropagation()}>
          <UserRowCheckbox id={user.id} />
        </span>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {(user.firstName || 'U')[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {user.firstName} {user.lastName}
            </span>
            {user.onHold && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-warning/10 text-warning border-warning/20">
                On Hold
              </Badge>
            )}
            {!user.isActive && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-destructive/10 text-destructive border-destructive/20">
                Disabled
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 shrink-0 ${ROLE_COLORS[user.systemRole] ?? ''}`}>
          {ROLE_LABELS[user.systemRole] ?? user.systemRole.replace(/_/g, ' ')}
        </Badge>
        <Badge variant="secondary" className="text-[10px] py-0 px-1.5 shrink-0">
          {TYPE_LABELS[user.userType] ?? user.userType}
        </Badge>
        {canEdit && (
          <form action={toggleUserActive.bind(null, user.id, !user.isActive)} onClick={(e) => e.stopPropagation()}>
            <Button type="submit" variant="ghost" size="sm" className="h-7 px-2 text-xs shrink-0">
              {user.isActive ? (
                <PowerOff className="h-3.5 w-3.5" />
              ) : (
                <Power className="h-3.5 w-3.5" />
              )}
            </Button>
          </form>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {open && (
        <div className="border-t p-3 space-y-3">
          {!canEdit && (
            <div className="rounded-md bg-warning/10 border border-warning/20 px-3 py-2 text-xs text-warning">
              View-only mode — Executive role cannot modify user records.
            </div>
          )}
          {canEdit && (
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">Name</label>
              <form key={`name-${user.id}-${user.firstName}-${user.lastName}`} action={updateUserNameByForm.bind(null, user.id)} className="flex gap-1.5">
                <input
                  name="firstName"
                  defaultValue={user.firstName}
                  placeholder="First name"
                  className="flex-1 px-2 py-1 text-xs border rounded-md bg-background h-7"
                  required
                />
                <input
                  name="lastName"
                  defaultValue={user.lastName}
                  placeholder="Last name"
                  className="flex-1 px-2 py-1 text-xs border rounded-md bg-background h-7"
                  required
                />
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2 shrink-0">Save</Button>
              </form>
            </div>
          )}
          <div className="grid gap-2.5 sm:grid-cols-2">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">System Role</label>
              <form key={`role-${user.id}-${user.systemRole}`} action={updateUserRoleByForm.bind(null, user.id)} className="flex gap-1.5">
                <select name="role" defaultValue={user.systemRole} className="flex-1 px-2 py-1 text-xs border rounded-md bg-background h-7">
                  {systemRoles.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2">Save</Button>
              </form>
            </div>
            <div>
              <label className="text-[11px] font-medium text-muted-foreground mb-1 block">User Type</label>
              <form key={`type-${user.id}-${user.userType}`} action={updateUserTypeByForm.bind(null, user.id)} className="flex gap-1.5">
                <select name="type" defaultValue={user.userType} className="flex-1 px-2 py-1 text-xs border rounded-md bg-background h-7">
                  {userTypes.map((t) => (
                    <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2">Save</Button>
              </form>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Departments</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {user.memberships.length === 0 ? (
                <span className="text-[11px] text-muted-foreground italic">None</span>
              ) : (
                user.memberships.map((m) => (
                  <Badge key={m.id} variant="secondary" className="gap-1 text-[10px] py-0 px-1.5">
                    {m.department.name}
                    {m.position && <span className="text-muted-foreground">({m.position.title})</span>}
                    {m.isPrimary && <span className="text-amber-500">★</span>}
                    <form action={removeDepartmentMembership.bind(null, m.id)} className="inline-flex">
                      <button type="submit" className="ml-0.5 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </form>
                  </Badge>
                ))
              )}
            </div>
            {canEdit && (
              <form action={assignDeptByForm.bind(null, user.id)} className="flex gap-1.5 flex-wrap">
                <select name="departmentId" className="px-2 py-1 text-xs border rounded-md bg-background h-7" required>
                  <option value="">Dept...</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <select name="positionId" className="px-2 py-1 text-xs border rounded-md bg-background h-7">
                  <option value="">No position</option>
                  {positions.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-[11px] h-7">
                  <input type="checkbox" name="isPrimary" value="true" />
                  Primary
                </label>
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2">
                  <Plus className="h-3 w-3 mr-0.5" />Assign
                </Button>
              </form>
            )}
          </div>

          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1.5 block">Temporary Module Roles</label>
            <div className="flex flex-wrap gap-1 mb-2">
              {user.roleAssignments.length === 0 ? (
                <span className="text-[11px] text-muted-foreground italic">None</span>
              ) : (
                user.roleAssignments.map((ra) => (
                  <Badge key={ra.id} variant="outline" className="gap-1 text-[10px] py-0 px-1.5 bg-blue-500/5 border-blue-500/20">
                    {ra.module} · {ra.role}
                    {ra.department && <> @ {ra.department.name}</>}
                    <form action={revokeTemporaryRole.bind(null, ra.id)} className="inline-flex">
                      <button type="submit" className="ml-0.5 hover:text-red-500">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </form>
                  </Badge>
                ))
              )}
            </div>
            {canEdit && (
              <form action={assignTempRoleByForm.bind(null, user.id)} className="flex gap-1.5 flex-wrap">
                <select name="module" className="px-2 py-1 text-xs border rounded-md bg-background h-7" required>
                  <option value="">Module...</option>
                  {modules.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <select name="role" className="px-2 py-1 text-xs border rounded-md bg-background h-7" required>
                  <option value="">Role...</option>
                  {tempRoles.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <select name="tempDeptId" className="px-2 py-1 text-xs border rounded-md bg-background h-7">
                  <option value="">All depts</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="outline" className="text-xs h-7 px-2">
                  <Plus className="h-3 w-3 mr-0.5" />Grant
                </Button>
              </form>
            )}
          </div>

          {canEdit && (
            <div className="pt-2 border-t">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setDeleteModalOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete User
              </Button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={deleteModalOpen}
        onOpenChange={(o) => {
          if (!deleting) {
            setDeleteModalOpen(o)
            if (!o) setConfirmText('')
          }
        }}
        title="Permanently delete this user?"
        description={`This will permanently delete ${user.firstName} ${user.lastName} (${user.email}) and all associated records. This action cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => {
                setDeleteModalOpen(false)
                setConfirmText('')
              }}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleDelete}
              disabled={deleting || confirmText !== CONFIRM_WORD}
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Delete User
            </Button>
          </>
        }
      >
        <p className="text-xs text-muted-foreground mb-2">
          Type <span className="font-mono font-semibold text-foreground">{CONFIRM_WORD}</span> below to proceed.
        </p>
        <input
          autoFocus
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={CONFIRM_WORD}
          className="w-full px-3 py-1.5 text-xs border rounded-md bg-background h-8 font-mono"
          disabled={deleting}
        />
      </Modal>
    </div>
  )
}
