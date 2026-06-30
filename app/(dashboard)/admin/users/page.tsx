import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Shield,
  Building2,
  Plus,
  Trash2,
  UserPlus,
} from 'lucide-react'
import {
  updateUserRole,
  updateUserType,
  toggleUserActive,
  assignDepartmentMembership,
  removeDepartmentMembership,
  assignTemporaryRole,
  revokeTemporaryRole,
  createDepartment,
  createUser,
} from './actions'
import { redirect } from 'next/navigation'

export default async function AdminUsersPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const [users, departments, positions] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        profile: true,
        memberships: { include: { department: true, position: true } },
        roleAssignments: { where: { isActive: true }, include: { department: true } },
      },
    }),
    prisma.department.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { positions: true },
    }),
    prisma.position.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    }),
  ])

  const systemRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'STAFF', 'VA']
  const userTypes = ['INTERNAL_STAFF', 'VIRTUAL_ASSISTANT']
  const tempRoles = ['CONTRIBUTOR', 'VIEWER', 'APPROVER']
  const modules = ['clients', 'vas', 'assignments', 'work-logs', 'skills', 'reports', 'admin']

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Panel</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage users, roles, and department assignments</p>
        </div>
        <form
          action={async (formData: FormData) => {
            'use server'
            const name = formData.get('name') as string
            const description = formData.get('description') as string
            if (name) await createDepartment(name, description || null, true, null)
          }}
          className="flex gap-2"
        >
          <input
            name="name"
            placeholder="New department name..."
            className="px-3 py-1.5 text-sm border rounded-md bg-background"
            required
          />
          <input
            name="description"
            placeholder="Description (optional)"
            className="px-3 py-1.5 text-sm border rounded-md bg-background hidden sm:block"
          />
          <Button type="submit" size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-1" />
            Add
          </Button>
        </form>
      </div>

      {/* Create User */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserPlus className="h-4 w-4" />
            Add User
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={async (formData: FormData) => {
              'use server'
              try {
                await createUser(formData)
              } catch (e: any) {
                console.error('[createUser]', e?.message)
              }
            }}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5"
          >
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
              defaultValue=""
              required
            >
              <option value="" disabled>Select role...</option>
              <option value="SUPER_ADMIN">Super Admin</option>
              <option value="SYSTEM_ADMIN">System Admin</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="DEPT_MANAGER">Dept Manager</option>
              <option value="STAFF">Staff</option>
              <option value="VA">VA</option>
            </select>
            <select
              name="userType"
              className="px-3 py-1.5 text-sm border rounded-md bg-background lg:col-span-2"
              defaultValue="INTERNAL_STAFF"
            >
              <option value="INTERNAL_STAFF">Internal Staff</option>
              <option value="VIRTUAL_ASSISTANT">Virtual Assistant</option>
            </select>
            <div className="lg:col-span-3 flex items-center justify-end gap-2">
              <p className="text-[11px] text-muted-foreground italic">
                After creating, the user signs in with their matching Google account.
              </p>
              <Button type="submit" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Add User
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Users */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Users ({users.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((u) => (
              <div
                key={u.id}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {u.firstName} {u.lastName}
                      {!u.isActive && (
                        <Badge variant="outline" className="ml-2 bg-red-500/10 text-red-600 border-red-500/20 text-xs">
                          Disabled
                        </Badge>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={toggleUserActive.bind(null, u.id, !u.isActive)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-xs">
                        {u.isActive ? 'Disable' : 'Enable'}
                      </Button>
                    </form>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {/* System Role */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">System Role</label>
                    <form key={`role-${u.id}-${u.systemRole}`} action={async (formData: FormData) => {
                      'use server'
                      const role = formData.get('role') as string
                      await updateUserRole(u.id, role)
                    }}>
                      <div className="flex gap-2">
                        <select name="role" defaultValue={u.systemRole} className="px-2 py-1 text-xs border rounded-md bg-background flex-1">
                          {systemRoles.map((r) => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline" className="text-xs h-7">Save</Button>
                      </div>
                    </form>
                  </div>

                  {/* User Type */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">User Type</label>
                    <form key={`type-${u.id}-${u.userType}`} action={async (formData: FormData) => {
                      'use server'
                      const type = formData.get('type') as string
                      await updateUserType(u.id, type)
                    }}>
                      <div className="flex gap-2">
                        <select name="type" defaultValue={u.userType} className="px-2 py-1 text-xs border rounded-md bg-background flex-1">
                          {userTypes.map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <Button type="submit" size="sm" variant="outline" className="text-xs h-7">Save</Button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* Department Memberships */}
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Department Memberships</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {u.memberships.map((m) => (
                      <Badge key={m.id} variant="secondary" className="gap-1 text-xs">
                        {m.department.name}
                        {m.position && <> ({m.position.title})</>}
                        {m.isPrimary && ' ★'}
                        <form action={removeDepartmentMembership.bind(null, m.id)} className="inline-flex">
                          <button type="submit" className="ml-1 hover:text-red-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </Badge>
                    ))}
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      'use server'
                      const deptId = formData.get('departmentId') as string
                      const posId = formData.get('positionId') as string
                      const isPrimary = formData.get('isPrimary') === 'true'
                      if (deptId) await assignDepartmentMembership(u.id, deptId, posId || null, isPrimary)
                    }}
                    className="flex gap-2 flex-wrap"
                  >
                    <select name="departmentId" className="px-2 py-1 text-xs border rounded-md bg-background" required>
                      <option value="">Add department...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name}
                        </option>
                      ))}
                    </select>
                    <select name="positionId" className="px-2 py-1 text-xs border rounded-md bg-background">
                      <option value="">No position</option>
                      {positions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title}
                        </option>
                      ))}
                    </select>
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" name="isPrimary" value="true" />
                      Primary
                    </label>
                    <Button type="submit" size="sm" variant="outline" className="text-xs h-7">
                      <Plus className="h-3 w-3 mr-1" />
                      Assign
                    </Button>
                  </form>
                </div>

                {/* Temporary Roles */}
                <div className="mt-3">
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">Temporary Module Roles</label>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {u.roleAssignments.map((ra) => (
                      <Badge key={ra.id} variant="outline" className="gap-1 text-xs bg-blue-500/5 border-blue-500/20">
                        {ra.module} — {ra.role}
                        {ra.department && <> @ {ra.department.name}</>}
                        <form action={revokeTemporaryRole.bind(null, ra.id)} className="inline-flex">
                          <button type="submit" className="ml-1 hover:text-red-500">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </form>
                      </Badge>
                    ))}
                  </div>
                  <form
                    action={async (formData: FormData) => {
                      'use server'
                      const role = formData.get('role') as string
                      const module = formData.get('module') as string
                      const deptId = formData.get('tempDeptId') as string
                      if (role && module) await assignTemporaryRole(u.id, role, module, deptId || null)
                    }}
                    className="flex gap-2 flex-wrap"
                  >
                    <select name="module" className="px-2 py-1 text-xs border rounded-md bg-background" required>
                      <option value="">Module...</option>
                      {modules.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                    <select name="role" className="px-2 py-1 text-xs border rounded-md bg-background" required>
                      <option value="">Role...</option>
                      {tempRoles.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <select name="tempDeptId" className="px-2 py-1 text-xs border rounded-md bg-background">
                      <option value="">All departments</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="outline" className="text-xs h-7">
                      <Plus className="h-3 w-3 mr-1" />
                      Grant
                    </Button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
