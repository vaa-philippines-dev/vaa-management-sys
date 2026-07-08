'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Search,
  Filter,
  X,
  Ellipsis,
  GripVertical,
} from 'lucide-react'
import { toggleDepartmentActive, deleteDepartment, reorderDepartments } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ServiceSelector } from '@/components/admin/ServiceSelector'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  ACTIVE: 'bg-success/15 text-success border-success/20',
  MERGED: 'bg-gray-500/15 text-gray-700 border-gray-500/20',
  SPLIT: 'bg-warning/15 text-warning border-warning/20',
  INACTIVE: 'bg-destructive/15 text-destructive border-destructive/20',
}

const LEVEL_COLORS: Record<string, string> = {
  EXECUTIVE: 'bg-purple-500',
  MANAGEMENT: 'bg-blue-500',
  SERVICE: 'bg-emerald-500',
}

export function DeptTree({
  departments,
  services = [],
  deptSkillMap = [],
  canEdit = true,
}: {
  departments: Dept[]
  services?: { id: string; name: string; category: string }[]
  deptSkillMap?: { departmentId: string; skillId: string }[]
  canEdit?: boolean
}) {
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

  const handleReorder = async (parentId: string | null, orderedIds: string[]) => {
    try {
      await reorderDepartments(parentId, orderedIds)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to reorder')
      router.refresh()
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
  const isFiltering = !!hasFilters

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
        {!isFiltering && canEdit && (
          <p className="text-[11px] text-muted-foreground">
            Hover a department to reveal actions. Drag the handle to reorder within its group.
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
        <SortableGroup
          key={filtered.map((d) => d.id).join(',')}
          items={filtered}
          parentId={null}
          canReorder={canEdit && !isFiltering}
          onReorder={handleReorder}
          renderItem={(d) => (
            <DeptNode
              key={d.id}
              dept={d}
              depth={0}
              onToggle={handleToggle}
              onDelete={handleDelete}
              onReorder={handleReorder}
              pendingId={pending}
              canEdit={canEdit}
              canReorder={canEdit && !isFiltering}
              allServices={services}
              assignedSkillIds={deptSkillMap.filter((m) => m.departmentId === d.id).map((m) => m.skillId)}
              deptSkillMap={deptSkillMap}
            />
          )}
        />
      )}
    </div>
  )
}

function SortableGroup({
  items,
  parentId,
  canReorder,
  onReorder,
  renderItem,
}: {
  items: Dept[]
  parentId: string | null
  canReorder: boolean
  onReorder: (parentId: string | null, orderedIds: string[]) => void
  renderItem: (d: Dept) => React.ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )
  const [order, setOrder] = useState(items.map((d) => d.id))

  const byId = new Map(items.map((d) => [d.id, d]))
  const orderedItems = order.filter((id) => byId.has(id)).map((id) => byId.get(id)!)

  const draggableIds = orderedItems.filter((d) => !d.isLevel).map((d) => d.id)

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = orderedItems.findIndex((d) => d.id === active.id)
    const newIndex = orderedItems.findIndex((d) => d.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(orderedItems, oldIndex, newIndex)
    const newOrder = reordered.map((d) => d.id)
    setOrder(newOrder)
    onReorder(parentId, newOrder)
  }

  if (!canReorder) {
    return <div className="space-y-1.5">{orderedItems.map(renderItem)}</div>
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={draggableIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-1.5">{orderedItems.map(renderItem)}</div>
      </SortableContext>
    </DndContext>
  )
}

function DeptNode({
  dept,
  depth,
  onToggle,
  onDelete,
  onReorder,
  pendingId,
  canEdit,
  canReorder,
  allServices,
  assignedSkillIds,
  deptSkillMap,
}: {
  dept: Dept
  depth: number
  onToggle: (id: string, status: string) => void
  onDelete: (id: string, name: string) => void
  onReorder: (parentId: string | null, orderedIds: string[]) => void
  pendingId: string | null
  canEdit: boolean
  canReorder: boolean
  allServices: { id: string; name: string; category: string }[]
  assignedSkillIds: string[]
  deptSkillMap: { departmentId: string; skillId: string }[]
}) {
  const [open, setOpen] = useState(depth < 1)
  const [showActions, setShowActions] = useState(false)
  const isPending = pendingId === dept.id

  const canMerge = canEdit && dept.status === 'ACTIVE' && !dept.isLevel
  const canSplit = canEdit && dept.status === 'ACTIVE' && !dept.isLevel
  const canToggle = canEdit && !dept.isLevel
  const canDelete = canEdit && !dept.isLevel && dept.childrenCount === 0
  const canDrag = canReorder && !dept.isLevel

  const sortable = useSortable({ id: dept.id, disabled: !canDrag })
  const style = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  }

  const levelColor = LEVEL_COLORS[dept.level ?? 'SERVICE'] ?? 'bg-gray-500'
  const assignedServices = allServices.filter((s) => assignedSkillIds.includes(s.id))

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={`rounded-lg border bg-card overflow-hidden group/row ${sortable.isDragging ? 'opacity-60 shadow-lg z-10 relative' : ''}`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2.5 transition-colors ${isPending ? 'opacity-50' : ''}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {canDrag && (
          <button
            type="button"
            {...sortable.attributes}
            {...sortable.listeners}
            className="p-0.5 rounded shrink-0 cursor-grab active:cursor-grabbing opacity-0 group-hover/row:opacity-100 transition-opacity touch-none"
            title="Drag to reorder"
          >
            <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        )}

        {dept.children.length > 0 ? (
          <button type="button" onClick={() => setOpen(!open)} className="p-0.5 hover:bg-accent rounded shrink-0">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <div className="w-4.5 shrink-0" />
        )}

        <div className={`h-5 w-1 rounded-full ${levelColor} shrink-0`} />

        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <Link
            href={`/dashboard?dept=${dept.id}`}
            className="text-sm font-medium truncate hover:text-primary transition-colors"
          >
            {dept.name}
          </Link>
          {dept.acronym && (
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {dept.acronym}
            </span>
          )}
          {dept.isLevel && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-purple-500/10 text-purple-700 border-purple-500/20">
              LEVEL
            </Badge>
          )}
          <Badge variant="outline" className={`text-[10px] py-0 px-1.5 ${STATUS_COLORS[dept.status] ?? ''}`}>
            {dept.status === 'ACTIVE' ? 'Active' : dept.status}
          </Badge>
          {dept.mergedIntoName && (
            <span className="text-[10px] text-muted-foreground">→ {dept.mergedIntoName}</span>
          )}
          {dept.splitFromName && (
            <span className="text-[10px] text-muted-foreground">← {dept.splitFromName}</span>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
          {dept.childrenCount > 0 && <span>{dept.childrenCount} sub</span>}
          {dept.membershipsCount > 0 && <span>{dept.membershipsCount} mem</span>}
          {dept.clientsCount > 0 && <span>{dept.clientsCount} cli</span>}
          {dept.level === 'SERVICE' && !dept.isLevel && assignedServices.length > 0 && (
            <span className="font-medium">{assignedServices.length} svc</span>
          )}
        </div>

        <div className="hidden md:flex items-center gap-1 shrink-0 opacity-0 group-hover/row:opacity-100 transition-opacity">
          {canEdit && dept.level === 'SERVICE' && !dept.isLevel && allServices.length > 0 && (
            <ServiceSelector
              departmentId={dept.id}
              departmentName={dept.name}
              canEdit={canEdit}
              services={allServices.map((s) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                assigned: assignedSkillIds.includes(s.id),
              }))}
            />
          )}
          {canMerge && (
            <Link href={`/admin/departments/merge/${dept.id}`}>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1">Merge</Button>
            </Link>
          )}
          {canSplit && (
            <Link href={`/admin/departments/split/${dept.id}`}>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1">Split</Button>
            </Link>
          )}
          {canToggle && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-1.5 gap-1"
              onClick={() => onToggle(dept.id, dept.status)}
              disabled={isPending}
            >
              {dept.status === 'ACTIVE' ? <ToggleRight className="h-3 w-3 text-success" /> : <ToggleLeft className="h-3 w-3" />}
              {dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          {canDelete && (
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-[10px] px-1.5 gap-1 text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
              onClick={() => onDelete(dept.id, dept.name)}
              disabled={isPending}
            >
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
        </div>

        <div className="md:hidden">
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setShowActions(!showActions)}>
            <Ellipsis className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {showActions && (
        <div className="border-t px-3 py-2 bg-muted/20 md:hidden flex flex-wrap gap-1.5">
          {canEdit && dept.level === 'SERVICE' && !dept.isLevel && allServices.length > 0 && (
            <ServiceSelector
              departmentId={dept.id}
              departmentName={dept.name}
              canEdit={canEdit}
              services={allServices.map((s) => ({
                id: s.id,
                name: s.name,
                category: s.category,
                assigned: assignedSkillIds.includes(s.id),
              }))}
            />
          )}
          {canMerge && (
            <Link href={`/admin/departments/merge/${dept.id}`}>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1">Merge</Button>
            </Link>
          )}
          {canSplit && (
            <Link href={`/admin/departments/split/${dept.id}`}>
              <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1">Split</Button>
            </Link>
          )}
          {canToggle && (
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1" onClick={() => onToggle(dept.id, dept.status)} disabled={isPending}>
              {dept.status === 'ACTIVE' ? <ToggleRight className="h-3 w-3 text-success" /> : <ToggleLeft className="h-3 w-3" />}
              {dept.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
            </Button>
          )}
          {canDelete && (
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1 text-destructive" onClick={() => onDelete(dept.id, dept.name)} disabled={isPending}>
              <Trash2 className="h-3 w-3" /> Delete
            </Button>
          )}
          <Link href={`/dashboard?dept=${dept.id}`}>
            <Button variant="outline" size="sm" className="h-6 text-[10px] px-1.5 gap-1"><ExternalLink className="h-3 w-3" /> Open</Button>
          </Link>
        </div>
      )}

      {open && (
        <div className="border-t bg-muted/20">
          {dept.level === 'SERVICE' && !dept.isLevel && assignedServices.length > 0 && (
            <div className="px-4 py-2 border-b flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">Services:</span>
              {assignedServices.map((s) => (
                <Badge key={s.id} variant="secondary" className="text-[10px] py-0 px-1.5">{s.name}</Badge>
              ))}
            </div>
          )}
          {dept.children.length > 0 && (
            <div className="py-1">
              <SortableGroup
                key={dept.children.map((c) => c.id).join(',')}
                items={dept.children}
                parentId={dept.id}
                canReorder={canReorder}
                onReorder={onReorder}
                renderItem={(child) => (
                  <DeptNode
                    key={child.id}
                    dept={child}
                    depth={depth + 1}
                    onToggle={onToggle}
                    onDelete={onDelete}
                    onReorder={onReorder}
                    pendingId={pendingId}
                    canEdit={canEdit}
                    canReorder={canReorder}
                    allServices={allServices}
                    assignedSkillIds={deptSkillMap.filter((m) => m.departmentId === child.id).map((m) => m.skillId)}
                    deptSkillMap={deptSkillMap}
                  />
                )}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
