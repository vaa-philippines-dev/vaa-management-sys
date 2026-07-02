'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, X, Search, Filter, Pencil, Trash2, ChevronDown, ChevronUp, FileText, ExternalLink } from 'lucide-react'
import { createSkill, updateSkill, deleteSkill } from '@/app/(dashboard)/skills/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Category = 'AMAZON' | 'WALMART' | 'TIKTOK_SHOP' | 'SHOPIFY' | 'GENERAL'

const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  AMAZON: { label: 'Amazon', color: 'bg-orange-500/15 text-orange-700 border-orange-500/20' },
  WALMART: { label: 'Walmart', color: 'bg-blue-500/15 text-blue-700 border-blue-500/20' },
  TIKTOK_SHOP: { label: 'TikTok Shop', color: 'bg-pink-500/15 text-pink-700 border-pink-500/20' },
  SHOPIFY: { label: 'Shopify', color: 'bg-green-500/15 text-green-700 border-green-500/20' },
  GENERAL: { label: 'General', color: 'bg-gray-500/15 text-gray-700 border-gray-500/20' },
}

const CATEGORY_ORDER: Category[] = ['AMAZON', 'WALMART', 'TIKTOK_SHOP', 'SHOPIFY', 'GENERAL']

type Skill = {
  id: string
  name: string
  shortName: string | null
  acronym: string | null
  category: string
  jobDescription: string | null
  attachmentUrl: string | null
  isActive: boolean
  vaCount: number
  departmentCount: number
}

export function SkillManager({ skills, canEdit = true }: { skills: Skill[]; canEdit?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'name' | 'category' | 'vaCount'>('category')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [, startTransition] = useTransition()

  const filtered = skills.filter((s) => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false
    if (statusFilter !== 'all') {
      if (statusFilter === 'active' && !s.isActive) return false
      if (statusFilter === 'inactive' && s.isActive) return false
    }
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

  const sorted = [...filtered].sort((a, b) => {
    let cmp = 0
    if (sortBy === 'name') cmp = a.name.localeCompare(b.name)
    else if (sortBy === 'category') cmp = a.category.localeCompare(b.category)
    else cmp = a.vaCount - b.vaCount
    return sortDir === 'asc' ? cmp : -cmp
  })

  const toggleSort = (col: 'name' | 'category' | 'vaCount') => {
    if (sortBy === col) setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const totalCount = skills.length
  const activeCount = skills.filter((s) => s.isActive).length
  const vaCount = skills.reduce((s, x) => s + x.vaCount, 0)
  const hasFilters = query || categoryFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Total</p>
          <p className="text-2xl font-bold leading-none mt-1">{totalCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Active</p>
          <p className="text-2xl font-bold leading-none mt-1 text-emerald-700">{activeCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">VA Assignments</p>
          <p className="text-2xl font-bold leading-none mt-1">{vaCount}</p>
        </div>
        <div className="rounded-xl border bg-card p-3.5">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Categories</p>
          <p className="text-2xl font-bold leading-none mt-1">{new Set(skills.map((s) => s.category)).size}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, short name, or acronym..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-2.5 h-9 text-xs border rounded-md bg-background min-w-[110px]"
            >
              <option value="all">All Categories</option>
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{CATEGORY_META[c].label}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 h-9 text-xs border rounded-md bg-background min-w-[110px]"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            {hasFilters && (
              <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => { setQuery(''); setCategoryFilter('all'); setStatusFilter('all') }}>
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
            {canEdit && (
              <Button size="sm" className="h-9 text-xs" onClick={() => { setShowAdd(!showAdd); setEditingId(null) }}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Service
              </Button>
            )}
          </div>
        </div>

        {showAdd && canEdit && (
          <AddEditForm
            mode="add"
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

        {hasFilters && (
          <p className="text-[11px] text-muted-foreground">
            Showing {sorted.length} of {totalCount} service{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No services match your filters.</p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left p-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('name')}>
                    <span className="flex items-center gap-1">Name {sortBy === 'name' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden sm:table-cell">Short</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden md:table-cell">Acronym</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('category')}>
                    <span className="flex items-center gap-1">Category {sortBy === 'category' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden lg:table-cell">Job Description</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground hidden lg:table-cell">Attachment</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort('vaCount')}>
                    <span className="flex items-center gap-1">VAs {sortBy === 'vaCount' && (sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}</span>
                  </th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Depts</th>
                  <th className="text-left p-2.5 font-medium text-muted-foreground">Status</th>
                  {canEdit && <th className="text-left p-2.5 font-medium text-muted-foreground w-0"> </th>}
                </tr>
              </thead>
              <tbody>
                {sorted.map((s) => (
                  <SkillRow
                    key={s.id}
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
                      if (!confirm(`Delete "${s.name}"? This cannot be undone.`)) return
                      try {
                        await deleteSkill(s.id)
                        toast.success('Service deleted')
                        startTransition(() => router.refresh())
                      } catch (e: any) {
                        toast.error(e.message ?? 'Failed to delete')
                      }
                    }}
                    canEdit={canEdit}
                  />
                ))}
              </tbody>
            </table>
          </div>
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
}: {
  skill: Skill
  isEditing: boolean
  onStartEdit: () => void
  onCancelEdit: () => void
  onSubmit: (fd: FormData) => Promise<void>
  onDelete: () => void
  canEdit: boolean
}) {
  const colorClass = CATEGORY_META[skill.category as Category]?.color ?? CATEGORY_META.GENERAL.color

  if (isEditing && canEdit) {
    return (
      <tr className="border-b bg-amber-500/5">
        <td colSpan={10} className="p-3">
          <AddEditForm
            mode="edit"
            initial={skill}
            onCancel={onCancelEdit}
            onSubmit={onSubmit}
          />
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20 transition-colors group">
      <td className="p-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium">{skill.name}</span>
        </div>
      </td>
      <td className="p-2.5 text-muted-foreground hidden sm:table-cell">{skill.shortName ?? '—'}</td>
      <td className="p-2.5 hidden md:table-cell">
        {skill.acronym ? (
          <code className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted">{skill.acronym}</code>
        ) : '—'}
      </td>
      <td className="p-2.5">
        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${colorClass}`}>
          {CATEGORY_META[skill.category as Category]?.label ?? skill.category}
        </Badge>
      </td>
      <td className="p-2.5 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">
        {skill.jobDescription ?? '—'}
      </td>
      <td className="p-2.5 hidden lg:table-cell">
        {skill.attachmentUrl ? (
          <a href={skill.attachmentUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
            <FileText className="h-3 w-3" />
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : '—'}
      </td>
      <td className="p-2.5 text-muted-foreground">{skill.vaCount}</td>
      <td className="p-2.5 text-muted-foreground">{skill.departmentCount}</td>
      <td className="p-2.5">
        <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${skill.isActive ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/20' : 'bg-gray-500/15 text-gray-700 border-gray-500/20'}`}>
          {skill.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </td>
      {canEdit && (
        <td className="p-2.5">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onStartEdit} title="Edit">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={onDelete} title="Delete">
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        </td>
      )}
    </tr>
  )
}

function AddEditForm({
  mode,
  initial,
  onCancel,
  onSubmit,
}: {
  mode: 'add' | 'edit'
  initial?: Skill
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
      <div className="grid gap-2 sm:grid-cols-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Name *</label>
          <Input
            name="name"
            defaultValue={initial?.name ?? ''}
            required
            placeholder="Amazon FBA Specialist"
            className="h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Short Name</label>
          <Input
            name="shortName"
            defaultValue={initial?.shortName ?? ''}
            placeholder="Amazon FBA"
            maxLength={50}
            className="h-8 text-xs mt-0.5"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Acronym</label>
          <Input
            name="acronym"
            defaultValue={initial?.acronym ?? ''}
            placeholder="AMZFBA"
            maxLength={6}
            onChange={(e) => {
              e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 6)
            }}
            className="h-8 text-xs font-mono mt-0.5"
          />
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Category</label>
          <select
            name="category"
            defaultValue={initial?.category ?? 'GENERAL'}
            className="h-8 text-xs border rounded-md bg-background px-2 w-full mt-0.5"
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{CATEGORY_META[c].label}</option>
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
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Job Description</label>
        <textarea
          name="jobDescription"
          defaultValue={initial?.jobDescription ?? ''}
          rows={2}
          placeholder="Brief description of what this service does..."
          className="w-full mt-0.5 px-2.5 py-1.5 text-xs border rounded-md bg-background resize-none"
        />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Attachment URL (Google Drive link)</label>
        <Input
          name="attachmentUrl"
          type="url"
          defaultValue={initial?.attachmentUrl ?? ''}
          placeholder="https://drive.google.com/..."
          className="h-8 text-xs mt-0.5"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" className="h-7 text-xs" disabled={submitting}>
          {submitting ? 'Saving...' : mode === 'add' ? 'Add Service' : 'Save Changes'}
        </Button>
      </div>
    </form>
  )
}
