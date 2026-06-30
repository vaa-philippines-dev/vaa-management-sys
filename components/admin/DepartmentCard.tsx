'use client'

import { useState } from 'react'
import Link from 'next/link'
import { editDepartment, toggleDepartmentActive } from '@/app/(dashboard)/admin/users/actions'
import { Pencil, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'

export function DepartmentCard({
  dept,
  icon: Icon,
}: {
  dept: { id: string; name: string; description: string | null; isActive: boolean; _count: { memberships: number; clients: number } }
  icon: React.ComponentType<{ className?: string }>
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(dept.name)
  const [description, setDescription] = useState(dept.description ?? '')

  const editAction = editDepartment.bind(null, dept.id)
  const toggleAction = toggleDepartmentActive.bind(null, dept.id)

  return (
    <div className="p-4 rounded-lg border bg-card group">
      {editing ? (
        <form action={editAction} className="space-y-2">
          <input
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-2 py-1 text-sm border rounded-md bg-background"
            required
          />
          <input
            name="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full px-2 py-1 text-sm border rounded-md bg-background"
          />
          <div className="flex gap-1 justify-end">
            <button type="submit" className="inline-flex items-center justify-center rounded-md text-xs font-medium px-2 py-1 hover:bg-muted transition-colors">
              <Check className="h-3 w-3" />
            </button>
            <button type="button" className="inline-flex items-center justify-center rounded-md text-xs font-medium px-2 py-1 hover:bg-muted transition-colors" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
              <Link href={`/dashboard?dept=${dept.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                {dept.name}
              </Link>
              {!dept.isActive && (
                <span className="inline-flex h-5 items-center rounded-4xl border px-2 py-0.5 text-xs font-medium bg-red-500/10 text-red-600 border-red-500/20">Inactive</span>
              )}
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => setEditing(true)}
                className="p-1 hover:bg-accent rounded transition-colors"
                title="Edit department"
              >
                <Pencil className="h-3 w-3 text-muted-foreground" />
              </button>
              <form action={toggleAction}>
                <button
                  type="submit"
                  className="p-1 hover:bg-accent rounded transition-colors"
                  title={dept.isActive ? 'Deactivate' : 'Activate'}
                >
                  {dept.isActive ? (
                    <ToggleRight className="h-4 w-4 text-green-600" />
                  ) : (
                    <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </form>
            </div>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span>{dept._count.memberships} members</span>
            <span>{dept._count.clients} clients</span>
          </div>
          {dept.description && (
            <p className="text-xs text-muted-foreground mt-1">{dept.description}</p>
          )}
        </>
      )}
    </div>
  )
}
