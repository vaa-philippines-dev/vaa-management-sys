'use client'

import { useState, useMemo, useTransition } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  GitMerge,
  GitBranch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  X,
} from 'lucide-react'
import { toggleDepartmentActive, deleteDepartment } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

type Dept = {
  id: string
  name: string
  shortName: string | null
  acronym: string | null
  level: 'EXECUTIVE' | 'MANAGEMENT' | 'SERVICE' | null
  status: 'ACTIVE' | 'MERGED' | 'SPLIT' | 'INACTIVE'
  parentId: string | null
  children: Dept[]
  mergedIntoName: string | null
  splitFromName: string | null
  childrenCount: number
  membershipsCount: number
  clientsCount: number
  isLevel: boolean
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-500/15 text-green-700 border-green-500/20',
  MERGED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
  SPLIT: 'bg-orange-500/15 text-orange-700 border-orange-500/20',
  INACTIVE: 'bg-red-500/15 text-red-600 border-red-500/20',
}

const LEVEL_COLORS: Record<string, string> = {
  EXECUTIVE: 'bg-purple-500',
  MANAGEMENT: 'bg-blue-500',
  SERVICE: 'bg-emerald-500',
}

const LEVEL_BG: Record<string, string> = {
  EXECUTIVE: 'hover:bg-purple-500/5',
  MANAGEMENT: 'hover:bg-blue-500/5',
  SERVICE: 'hover:bg-emerald-500/5',
}

export function DeptTree({ departments, canEdit = true }: { departments: Dept[]; canEdit?: boolean }) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [pending, setPending] = useState<string | null>(null)

  const handleToggle = async (id: string, currentStatus: string) => {
    setPending(id)
    try {
      await toggleDepartmentActive(id)
      toast.success(`Department ${currentStatus === 'ACTIVE' ? 'deactivated' : 'activated'}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to toggle status')
    } finally {
      setPending(null)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setPending(id)
    try {
      await deleteDepartment(id)
      toast.success('Department deleted')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete')
    } finally {
      setPending(null)
    }
  }

  const matches = (d: Dept) => {
    if (levelFilter !== 'all' && d.level !== levelFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    if (query) {
      const q = query.toLowerCase()
      if (
        !d.name.toLowerCase().includes(q) &&
        !(d.acronym ?? '').toLowerCase().includes(q) &&
        !(d.shortName ?? '').toLowerCase().includes(q)
      ) {
        return false
      }
    }
    return true
  }

  const filtered = useMemo(() => {
    const filterTree = (d: Dept): Dept | null => {
      if (!matches(d)) {
        const kids = d.children.map(filterTree).filter((c): c is Dept => c !== null)
        if (kids.length === 0) return null
        return { ...d, children: kids }
      }
      return d
    }
    return departments.map(filterTree).filter((d): d is Dept => d !== null)
  }, [departments, query, levelFilter, statusFilter])

  const totalCount = departments.length
  const filteredCount = useMemo(() => {
    const countTree = (d: Dept): number =>
      d.children.reduce((s, c) => s + countTree(c), 1)
    return filtered.reduce((s, d) => s + countTree(d), 0)
  }, [filtered])

  const hasFilters = query || levelFilter !== 'all' || statusFilter !== 'all'

  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-card p-3 space-y-2.5">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, acronym, or short name..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="px-2.5 h-9 text-xs border rounded-md bg-background min-w-[110px]"
            >
              <option value="all">All Levels</option>
              <option value="EXECUTIVE">Executive</option>
              <option value="MANAGEMENT">Management</option>
              <option value="SERVICE">Service</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-2.5 h-9 text-xs border rounded-md bg-background min-w-[110px]"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="MERGED">Merged</option>
              <option value="SPLIT">Split</option>
            </select>
            {hasFilters && (
              <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs"
                onClick={() => {
                  setQuery('')
                  setLevelFilter('all')
                  setStatusFilter('all')
                }}
              >
                <X className="h-3 w-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </div>
        {hasFilters && (
          <p className="text-[11px] text-muted-foreground">
            Showing {filteredCount} of {totalCount} department{totalCount !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center">
          <Filter className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No departments match your filters.</p>
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => {
                setQuery('')
                setLevelFilter('all')
                setStatusFilter('all')
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((d) => (
            <DeptNode
              key={d.id}
              dept={d}
              depth={0}
              onToggle={handleToggle}
              onDelete={handleDelete}
              pendingId={pending}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function DeptNode({
  dept,
  depth,
  onToggle,
  onDelete,
  pendingId,
  canEdit,
}: {
  dept: Dept
  depth: number
  onToggle: (id: string, status: string) => void
  onDelete: (id: string, name: string) => void
  pendingId: string | null
  canEdit: boolean
}) {
  const [open, setOpen] = useState(depth < 1)
  const isPending = pendingId === dept.id

  const canMerge = canEdit && dept.status === 'ACTIVE' && !dept.isLevel
  const canSplit = canEdit && dept.status === 'ACTIVE' && !dept.isLevel
  const canToggle = canEdit && !dept.isLevel
  const canDelete = canEdit && !dept.isLevel && dept.childrenCount === 0

  const levelColor = LEVEL_COLORS[dept.level ?? 'SERVICE'] ?? 'bg-gray-500'
  const levelBg = LEVEL_BG[dept.level ?? 'SERVICE'] ?? ''

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div
        className={`flex items-center gap-2 px-3 py-2 transition-colors ${levelBg} ${isPending ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {dept.children.length > 0 ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="p-0.5 hover:bg-accent rounded transition-colors shrink-0"
          >
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-4.5 shrink-0" />
        )}

        <div className={`h-5 w-1 rounded-full ${levelColor} shrink-0`} />

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{dept.name}</span>
          {dept.acronym && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {dept.acronym}
            </span>
          )}
          {dept.shortName && dept.shortName !== dept.name && (
            <span className="text-xs text-muted-foreground hidden sm:inline">({dept.shortName})</span>
          )}
          {dept.isLevel && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-500/10 text-purple-700 border-purple-500/20">
              LEVEL
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${STATUS_COLORS[dept.status] ?? ''}`}>
            {dept.status}
            {dept.status === 'ACTIVE' ? ' ✓' : ''}
          </Badge>
        </div>

        <div className="hidden lg:flex items-center gap-2.5 text-[11px] text-muted-foreground shrink-0">
          {dept.childrenCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">{dept.childrenCount}</span> sub
            </span>
          )}
          {dept.membershipsCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">{dept.membershipsCount}</span> mem
            </span>
          )}
          {dept.clientsCount > 0 && (
            <span className="flex items-center gap-1">
              <span className="font-medium text-foreground">{dept.clientsCount}</span> cli
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          {canMerge && (
            <Link href={`/admin/departments/merge/${dept.id}`}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Merge">
                <GitMerge className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {canSplit && (
            <Link href={`/admin/departments/split/${dept.id}`}>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Split">
                <GitBranch className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          {canToggle && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onToggle(dept.id, dept.status)}
              disabled={isPending}
              title={dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            >
              {dept.status === 'ACTIVE' ? (
                <ToggleRight className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onDelete(dept.id, dept.name)}
              disabled={isPending}
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
          <Link href={`/dashboard?dept=${dept.id}`}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View dashboard">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {open && dept.children.length > 0 && (
        <div className="border-t bg-muted/20">
          {dept.children.map((child) => (
            <DeptNode
              key={child.id}
              dept={child}
              depth={depth + 1}
              onToggle={onToggle}
              onDelete={onDelete}
              pendingId={pendingId}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  )
}
