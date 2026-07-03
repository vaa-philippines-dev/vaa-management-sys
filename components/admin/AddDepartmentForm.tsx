'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, ChevronUp, ChevronDown, Loader2 } from 'lucide-react'
import { createDepartment } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Parent = { id: string; name: string }

export function AddDepartmentForm({
  canEdit,
  levelParents,
  managementDepartments,
}: {
  canEdit: boolean
  levelParents: Parent[]
  managementDepartments: Parent[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState('MANAGEMENT')
  const [parentDeptId, setParentDeptId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!canEdit) return null

  const getParentId = (lvl: string) => {
    const parent = levelParents.find((p) => p.name === lvl.charAt(0) + lvl.slice(1).toLowerCase())
    return parent?.id ?? null
  }

  const handleCancel = () => {
    setOpen(false)
    setParentDeptId('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const name = ((data.name as string) ?? '').trim()
    const shortName = ((data.shortName as string) ?? '').trim() || null
    const acronym = ((data.acronym as string) ?? '').trim().toUpperCase() || null

    if (!name) {
      toast.error('Department name is required')
      setSubmitting(false)
      return
    }
    try {
      const resolvedParentId = level === 'MANAGEMENT' && parentDeptId ? parentDeptId : getParentId(level)
      await createDepartment(name, null, false, resolvedParentId, level, shortName, acronym)
      toast.success(`"${name}" created`)
      setOpen(false)
      setParentDeptId('')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to create department')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <Plus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Add Department</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {open && (
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Name *</label>
                <Input name="name" required placeholder="Department name" maxLength={100} className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Short Name</label>
                <Input name="shortName" placeholder="Optional" maxLength={50} className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Acronym</label>
                <Input
                  name="acronym"
                  placeholder="2-6 letters"
                  maxLength={6}
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 6)
                  }}
                  className="h-8 text-xs font-mono mt-0.5"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Level *</label>
                <select
                  value={level}
                  onChange={(e) => {
                    setLevel(e.target.value)
                    if (e.target.value !== 'MANAGEMENT') setParentDeptId('')
                  }}
                  className="w-full h-8 text-xs border rounded-md bg-background px-2 mt-0.5"
                >
                  <option value="EXECUTIVE">Executive</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="SERVICE">Service</option>
                </select>
              </div>
            </div>

            {level === 'MANAGEMENT' && (
              <div className="grid gap-2 sm:grid-cols-4">
                <div className="sm:col-span-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Parent Department</label>
                  <select
                    value={parentDeptId}
                    onChange={(e) => setParentDeptId(e.target.value)}
                    className="w-full h-8 text-xs border rounded-md bg-background px-2 mt-0.5"
                  >
                    <option value="">— None (top-level under Management) —</option>
                    {managementDepartments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <div className="flex items-end gap-2 justify-end">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Creating...</>
                ) : (
                  <><Plus className="h-3 w-3 mr-1" /> Create Department</>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
