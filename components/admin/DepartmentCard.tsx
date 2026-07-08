'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { editDepartment, toggleDepartmentActive } from '@/app/(dashboard)/admin/users/actions'
import { Pencil, Check, X, ToggleLeft, ToggleRight } from 'lucide-react'

export function DepartmentCard({
  dept,
  icon,
}: {
  dept: { id: string; name: string; description: string | null; status: 'ACTIVE' | 'MERGED' | 'SPLIT' | 'INACTIVE'; _count: { memberships: number; clients: number } }
  icon: React.ReactNode
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
            <Button type="submit" size="sm" variant="ghost" className="text-xs h-7">
              <Check className="h-3 w-3" />
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-xs h-7" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {icon}
              <Link href={`/dashboard?dept=${dept.id}`} className="text-sm font-medium hover:text-primary transition-colors">
                {dept.name}
              </Link>
              {dept.status !== 'ACTIVE' && (
                <Badge variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/20">{dept.status}</Badge>
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
                  title={dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                >
                  {dept.status === 'ACTIVE' ? (
                    <ToggleRight className="h-4 w-4 text-success" />
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
