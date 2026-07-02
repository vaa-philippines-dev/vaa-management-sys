'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  GitMerge,
  GitBranch,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
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
  parentName: string | null
  mergedIntoId: string | null
  mergedIntoName: string | null
  splitFromId: string | null
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

export function DeptAdminRow({ dept }: { dept: Dept }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)

  const canMerge = dept.status === 'ACTIVE' && !dept.isLevel
  const canSplit = dept.status === 'ACTIVE' && !dept.isLevel
  const canToggle = !dept.isLevel
  const canDelete = !dept.isLevel && dept.childrenCount === 0

  const handleToggle = async () => {
    setPending(true)
    try {
      await toggleDepartmentActive(dept.id)
      toast.success(`Department ${dept.status === 'ACTIVE' ? 'deactivated' : 'activated'}`)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to toggle status')
    } finally {
      setPending(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return
    setPending(true)
    try {
      await deleteDepartment(dept.id)
      toast.success('Department deleted')
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to delete')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="p-1 hover:bg-accent rounded transition-colors"
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium truncate">{dept.name}</span>
            {dept.acronym && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                {dept.acronym}
              </Badge>
            )}
            {dept.shortName && dept.shortName !== dept.name && (
              <span className="text-xs text-muted-foreground">({dept.shortName})</span>
            )}
            {dept.isLevel && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-500/10 text-purple-700 border-purple-500/20">
                LEVEL
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${STATUS_COLORS[dept.status] ?? ''}`}>
              {dept.status}
            </Badge>
          </div>
          {dept.parentName && (
            <p className="text-xs text-muted-foreground mt-0.5">Parent: {dept.parentName}</p>
          )}
          {dept.mergedIntoName && (
            <p className="text-xs text-muted-foreground mt-0.5">Merged into: {dept.mergedIntoName}</p>
          )}
          {dept.splitFromName && (
            <p className="text-xs text-muted-foreground mt-0.5">Split from: {dept.splitFromName}</p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
          <span>{dept.childrenCount} sub</span>
          <span>{dept.membershipsCount} mem</span>
          <span>{dept.clientsCount} cli</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {canMerge && (
            <Link href={`/admin/departments/merge/${dept.id}`}>
              <Button variant="ghost" size="sm" className="text-xs h-7" title="Merge into another department">
                <GitMerge className="h-3.5 w-3.5 mr-1" />
                Merge
              </Button>
            </Link>
          )}
          {canSplit && (
            <Link href={`/admin/departments/split/${dept.id}`}>
              <Button variant="ghost" size="sm" className="text-xs h-7" title="Split into multiple departments">
                <GitBranch className="h-3.5 w-3.5 mr-1" />
                Split
              </Button>
            </Link>
          )}
          {canToggle && (
            <form action={handleToggle}>
              <Button type="submit" variant="ghost" size="sm" className="text-xs h-7 px-2" disabled={pending} title={dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}>
                {dept.status === 'ACTIVE' ? (
                  <ToggleRight className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <ToggleLeft className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </form>
          )}
          {canDelete && (
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleDelete} disabled={pending} title="Delete">
              <Trash2 className="h-3.5 w-3.5 text-red-500" />
            </Button>
          )}
          <Link href={`/dashboard?dept=${dept.id}`} className="ml-1">
            <Button variant="ghost" size="sm" className="text-xs h-7 px-2" title="View dashboard">
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>

      {open && (
        <div className="border-t px-3 py-2 bg-muted/30 text-xs text-muted-foreground">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div><span className="font-medium">Level:</span> {dept.level ?? '—'}</div>
            <div><span className="font-medium">Status:</span> {dept.status}</div>
            <div><span className="font-medium">Sub-depts:</span> {dept.childrenCount}</div>
            <div><span className="font-medium">Members:</span> {dept.membershipsCount}</div>
            <div><span className="font-medium">Clients:</span> {dept.clientsCount}</div>
            <div className="col-span-2 truncate"><span className="font-medium">Parent:</span> {dept.parentName ?? '(top level)'}</div>
          </div>
        </div>
      )}
    </div>
  )
}
