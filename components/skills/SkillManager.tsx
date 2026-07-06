'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Search, Pencil, Trash2, ChevronDown, ChevronUp, Building2, Users } from 'lucide-react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { createSkill, updateSkill, deleteSkill } from '@/app/(dashboard)/skills/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Category = 'STANDARD' | 'UPSKILL' | 'SPECIAL'

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  STANDARD: { label: 'Standard', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  UPSKILL: { label: 'Upskill', color: 'bg-purple-500/15 text-purple-700 border-purple-500/20' },
  SPECIAL: { label: 'Special', color: 'bg-amber-500/15 text-amber-700 border-amber-500/20' },
}

type Skill = {
  id: string
  name: string
  shortName: string | null
  acronym: string | null
  category: string
  isActive: boolean
  vaCount: number
  departmentNames: string[]
}

type DeptOption = { id: string; name: string }
type DeptSkill = { departmentId: string; skillId: string; department: { id: string; name: string } }

export function SkillManager({
  skills,
  departments,
  deptSkills,
  canEdit = true,
}: {
  skills: Skill[]
  departments: DeptOption[]
  deptSkills: DeptSkill[]
  canEdit?: boolean
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = skills.filter((s) => {
    if (query) {
      const q = query.toLowerCase()
      if (
        !s.name.toLowerCase().includes(q) &&
        !(s.shortName ?? '').toLowerCase().includes(q) &&
        !(s.acronym ?? '').toLowerCase().includes(q)
      ) return false
    }
    return true
  })

  // Group skills by department, plus "Unassigned" for skills with no department
  const byDept = new Map<string, Skill[]>()
  byDept.set('__unassigned__', [])
  for (const d of departments) byDept.set(d.id, [])
  for (const skill of filtered) {
    const ds = deptSkills.filter((ds) => ds.skillId === skill.id)
    if (ds.length === 0) {
      byDept.get('__unassigned__')!.push(skill)
    } else {
      for (const d of ds) {
        if (!byDept.has(d.departmentId)) byDept.set(d.departmentId, [])
        byDept.get(d.departmentId)!.push(skill)
      }
    }
  }

  const totalCount = skills.length
  const activeCount = skills.filter((s) => s.isActive).length

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 px-3 py-2 rounded-xl border bg-muted/30 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Building2 className="h-3 w-3" />
          {totalCount} services
        </span>
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {activeCount} active
        </span>
        <span className="flex items-center gap-1.5">
          {departments.length} departments
        </span>
      </div>

      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, short name, or acronym..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        {canEdit && (
          <Button size="sm" className="h-9 text-xs gap-1" onClick={() => { setShowAdd(!showAdd); setEditingId(null) }}>
            <Plus className="h-3.5 w-3.5" />
            Add Service
          </Button>
        )}
      </div>

      {showAdd && canEdit && (
        <AddEditForm
          mode="add"
          departments={departments}
          onCancel={() => setShowAdd(false)}
          onSubmit={async (fd) => {
            const r = await createSkill(fd)
            if (r?.error) { toast.error(r.error); return }
            toast.success('Service created')
            setShowAdd(false)
            startTransition(() => router.refresh())
          }}
        />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Building2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No services match your search</p>
        </div>
      ) : (
        <div className="space-y-4">
          {departments.map((dept) => {
            const items = byDept.get(dept.id) || []
            if (items.length === 0) return null
            return (
              <div key={dept.id} className="rounded-xl border bg-card overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-semibold">{dept.name}</span>
                  <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{items.length}</Badge>
                </div>
                <Table className="text-xs table-fixed">
                  <TableHeader>
                    <TableRow className="bg-muted/10">
                      <TableHead className="px-3 py-2.5 w-[30%]">Name</TableHead>
                      <TableHead className="px-3 py-2.5 w-[18%] hidden sm:table-cell">Short</TableHead>
                      <TableHead className="px-3 py-2.5 w-[14%] hidden md:table-cell">Acronym</TableHead>
                      <TableHead className="px-3 py-2.5 w-[14%]">Category</TableHead>
                      <TableHead className="px-3 py-2.5 w-[8%]">VAs</TableHead>
                      <TableHead className="px-3 py-2.5 w-[12%]">Status</TableHead>
                      {canEdit && <TableHead className="px-3 py-2.5 w-[4%]"> </TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((s) => (
                      <SkillRow
                        key={s.id + dept.id}
                        skill={s}
                        isEditing={editingId === s.id}
                        onStartEdit={() => { setEditingId(s.id); setShowAdd(false) }}
                        onCancelEdit={() => setEditingId(null)}
                        onSubmit={async (fd) => {
                          const r = await updateSkill(s.id, fd)
                          if (r?.error) { toast.error(r.error); return }
                          toast.success(`${s.name} updated`)
                          setEditingId(null)
                          startTransition(() => router.refresh())
                        }}
                        onDelete={async () => {
                          if (!confirm(`Delete "${s.name}"?`)) return
                          try {
                            await deleteSkill(s.id)
                            toast.success('Service deleted')
                            startTransition(() => router.refresh())
                          } catch (e: any) { toast.error(e.message ?? 'Failed') }
                        }}
                        canEdit={canEdit}
                        departments={departments}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          })}

          {(byDept.get('__unassigned__') || []).length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/20 border-b">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold">Unassigned</span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5">{byDept.get('__unassigned__')!.length}</Badge>
              </div>
              <Table className="text-xs table-fixed">
                <TableHeader>
                  <TableRow className="bg-muted/10">
                    <TableHead className="px-3 py-2.5 w-[30%]">Name</TableHead>
                    <TableHead className="px-3 py-2.5 w-[18%] hidden sm:table-cell">Short</TableHead>
                    <TableHead className="px-3 py-2.5 w-[14%] hidden md:table-cell">Acronym</TableHead>
                    <TableHead className="px-3 py-2.5 w-[14%]">Category</TableHead>
                    <TableHead className="px-3 py-2.5 w-[8%]">VAs</TableHead>
                    <TableHead className="px-3 py-2.5 w-[12%]">Status</TableHead>
                    {canEdit && <TableHead className="px-3 py-2.5 w-[4%]"> </TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(byDept.get('__unassigned__') || []).map((s) => (
                    <SkillRow
                      key={s.id + '__unassigned__'}
                      skill={s}
                      isEditing={editingId === s.id}
                      onStartEdit={() => { setEditingId(s.id); setShowAdd(false) }}
                      onCancelEdit={() => setEditingId(null)}
                      onSubmit={async (fd) => {
                        const r = await updateSkill(s.id, fd)
                        if (r?.error) { toast.error(r.error); return }
                        toast.success(`${s.name} updated`)
                        setEditingId(null)
                        startTransition(() => router.refresh())
                      }}
                      onDelete={async () => {
                        if (!confirm(`Delete "${s.name}"?`)) return
                        try {
                          await deleteSkill(s.id)
                          toast.success('Service deleted')
                          startTransition(() => router.refresh())
                        } catch (e: any) { toast.error(e.message ?? 'Failed') }
                      }}
                      canEdit={canEdit}
                      departments={departments}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SkillRow({
  skill,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSubmit,
  onDelete,
  canEdit,
  departments,
}: {
  skill: Skill
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSubmit: (fd: FormData) => Promise<void>
  onDelete: () => void
  canEdit: boolean
  departments: DeptOption[]
}) {
  const colorClass = CATEGORY_META[skill.category as Category]?.color ?? CATEGORY_META.STANDARD.color

  if (isEditing && canEdit) {
    return (
      <TableRow className="bg-amber-500/5">
        <TableCell colSpan={7} className="p-3 whitespace-normal">
          <AddEditForm
            mode="edit"
            initial={skill}
            departments={departments}
            onCancel={onCancelEdit}
            onSubmit={onSubmit}
          />
        </TableCell>
      </TableRow>
    )
  }

  return (
    <TableRow className={`group border-l-4 ${skill.isActive ? 'border-l-emerald-500' : 'border-l-muted-foreground/30'}`}>
      <TableCell className="px-3 py-2.5 overflow-hidden">
        <span className="font-medium truncate block" title={skill.name}>{skill.name}</span>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell overflow-hidden">
        <span className="truncate block" title={skill.shortName ?? undefined}>{skill.shortName ?? '—'}</span>
      </TableCell>
      <TableCell className="px-3 py-2.5 hidden md:table-cell overflow-hidden">
        {skill.acronym ? (
          <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">{skill.acronym}</code>
        ) : '—'}
      </TableCell>
      <TableCell className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${colorClass}`}>
          {CATEGORY_META[skill.category as Category]?.label ?? skill.category}
        </Badge>
      </TableCell>
      <TableCell className="px-3 py-2.5 text-muted-foreground">{skill.vaCount}</TableCell>
      <TableCell className="px-3 py-2.5">
        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${skill.isActive ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20' : 'bg-gray-500/15 text-gray-700 border-gray-500/20'}`}>
          {skill.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </TableCell>
      {canEdit && (
        <TableCell className="px-3 py-2.5">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onStartEdit} title="Edit">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete} title="Delete">
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </TableCell>
      )}
    </TableRow>
  )
}

function AddEditForm({
  mode,
  initial,
  departments,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  initial?: Skill
  departments: DeptOption[]
  onCancel: () => void
  onSubmit: (fd: FormData) => Promise<void>
}) {
  const [submitting, setSubmitting] = useState(false)

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        setSubmitting(true)
        try {
          const fd = new FormData(e.currentTarget)
          await onSubmit(fd)
        } finally {
          setSubmitting(false)
        }
      }}
      className="rounded-lg border bg-background p-3 space-y-2.5"
    >
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Name *</label>
          <Input name="name" defaultValue={initial?.name ?? ''} required placeholder="Amazon FBA Specialist" className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Short Name</label>
          <Input name="shortName" defaultValue={initial?.shortName ?? ''} placeholder="Amazon FBA" maxLength={50} className="h-8 text-xs" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Acronym</label>
          <Input name="acronym" defaultValue={initial?.acronym ?? ''} placeholder="AMZFBA" maxLength={6} onChange={(e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 6) }} className="h-8 text-xs font-mono" />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Category</label>
          <select name="category" defaultValue={initial?.category ?? 'STANDARD'} className="h-8 text-xs border rounded-md bg-background px-2 w-full">
            <option value="STANDARD">Standard</option>
            <option value="UPSKILL">Upskill</option>
            <option value="SPECIAL">Special</option>
          </select>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Department</label>
          <select name="departmentId" defaultValue="" className="h-8 text-xs border rounded-md bg-background px-2 w-full">
            <option value="">None</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        {mode === 'edit' && (
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-xs h-8">
              <input type="checkbox" name="isActive" defaultChecked={initial?.isActive ?? true} />
              <span>Active</span>
            </label>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={submitting}>Cancel</Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={submitting}>
          {submitting ? 'Saving...' : mode === 'add' ? 'Add Service' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
