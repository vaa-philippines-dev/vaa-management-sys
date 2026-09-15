'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Plus, ExternalLink, Pencil, Trash2, FolderKanban } from 'lucide-react'
import { createProject, updateProject, deleteProject } from '@/app/(dashboard)/projects/actions'

export type ProjectRow = {
  id: string
  name: string
  description: string | null
  status: string
  priority: string
  proposedDate: string | null
  startDate: string | null
  completedDate: string | null
  proposalFileName: string | null
  proposalFileUrl: string | null
  referenceNotes: string | null
  remarks: string | null
  departmentId: string
  departmentName: string
  ownerId: string | null
  ownerName: string | null
}

// Labels mirror the sheet's own wording so a manager moving between the two
// reads the same status in both places.
const STATUS_LABELS: Record<string, string> = {
  FOR_REVIEW: 'For Review',
  FOR_APPROVAL: 'For Approval',
  APPROVED: 'Approved',
  IN_PROGRESS: 'In-Progress',
  COMPLETED: 'Completed',
  ON_HOLD: 'On Hold',
  DECLINED: 'Declined',
}

const PRIORITY_LABELS: Record<string, string> = {
  NORMAL: 'Normal',
  IMPORTANT: 'Important',
  CRITICAL: 'Critical',
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  FOR_REVIEW: 'outline',
  FOR_APPROVAL: 'outline',
  APPROVED: 'secondary',
  IN_PROGRESS: 'default',
  COMPLETED: 'secondary',
  ON_HOLD: 'outline',
  DECLINED: 'destructive',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(d)
}

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : ''
}

export function ProjectsBoard({
  projects,
  departments,
  owners,
  canMutate,
  showDepartment,
}: {
  projects: ProjectRow[]
  departments: { id: string; name: string }[]
  owners: { id: string; name: string }[]
  canMutate: boolean
  showDepartment: boolean
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<ProjectRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (statusFilter && p.status !== statusFilter) return false
      if (!q) return true
      return (
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.ownerName ?? '').toLowerCase().includes(q)
      )
    })
  }, [projects, statusFilter, search])

  // Deliberately not wrapped in startTransition: router.refresh() keeps a
  // transition pending until the server re-renders, which would hold the
  // modal open showing "Saving..." for the whole round trip. Closing first
  // and refreshing after gives the same freshness without the stuck dialog.
  const onSubmit = async (formData: FormData) => {
    setSaving(true)
    try {
      const res = editing ? await updateProject(editing.id, formData) : await createProject(formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(editing ? 'Project updated' : 'Project added')
      setEditing(null)
      setCreating(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (project: ProjectRow) => {
    if (!confirm(`Delete "${project.name}"? This cannot be undone.`)) return
    setSaving(true)
    try {
      const res = await deleteProject(project.id)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Project deleted')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const open = creating || editing !== null

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <span className="text-xs text-muted-foreground">
          {visible.length} of {projects.length}
        </span>
        {canMutate && departments.length > 0 && (
          <Button size="sm" className="ml-auto" onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            New Project
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <FolderKanban className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {projects.length === 0 ? 'No projects yet.' : 'No projects match these filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Status</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Proposed</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>Owner</TableHead>
                {canMutate && <TableHead className="w-24">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-sm">
                    <div className="font-medium">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-muted-foreground line-clamp-2">{p.description}</div>
                    )}
                    {p.proposalFileUrl && (
                      <a
                        href={p.proposalFileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {p.proposalFileName || 'Proposal file'}
                      </a>
                    )}
                  </TableCell>
                  {showDepartment && (
                    <TableCell className="text-muted-foreground">{p.departmentName}</TableCell>
                  )}
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[p.status] ?? 'outline'}>
                      {STATUS_LABELS[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        p.priority === 'CRITICAL'
                          ? 'text-destructive font-medium'
                          : p.priority === 'IMPORTANT'
                            ? 'text-warning font-medium'
                            : 'text-muted-foreground'
                      }
                    >
                      {PRIORITY_LABELS[p.priority] ?? p.priority}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.proposedDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.startDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.completedDate)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.ownerName ?? '—'}</TableCell>
                  {canMutate && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setEditing(p)} aria-label="Edit project">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => onDelete(p)} aria-label="Delete project">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal
        open={open}
        onOpenChange={(next) => {
          if (!next) {
            setCreating(false)
            setEditing(null)
          }
        }}
        title={editing ? 'Edit Project' : 'New Project'}
        size="lg"
      >
        <form action={onSubmit} className="space-y-3">
          <div>
            <Label htmlFor="name">Project name</Label>
            <Input id="name" name="name" defaultValue={editing?.name ?? ''} required />
          </div>

          <div>
            <Label htmlFor="description">Short description</Label>
            <Textarea id="description" name="description" rows={3} defaultValue={editing?.description ?? ''} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="departmentId">Department</Label>
              <Select
                id="departmentId"
                name="departmentId"
                defaultValue={editing?.departmentId ?? departments[0]?.id ?? ''}
                disabled={!!editing}
                className="w-full"
                required={!editing}
              >
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ownerId">Owner</Label>
              <Select id="ownerId" name="ownerId" defaultValue={editing?.ownerId ?? ''} className="w-full">
                <option value="">Unassigned</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" name="status" defaultValue={editing?.status ?? 'FOR_REVIEW'} className="w-full">
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="priority">Priority</Label>
              <Select id="priority" name="priority" defaultValue={editing?.priority ?? 'NORMAL'} className="w-full">
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="proposedDate">Date proposed</Label>
              <Input
                id="proposedDate"
                name="proposedDate"
                type="date"
                defaultValue={toDateInput(editing?.proposedDate ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="startDate">Start date</Label>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={toDateInput(editing?.startDate ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="completedDate">Date completed</Label>
              <Input
                id="completedDate"
                name="completedDate"
                type="date"
                defaultValue={toDateInput(editing?.completedDate ?? null)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="proposalFileName">Proposal file name</Label>
              <Input id="proposalFileName" name="proposalFileName" defaultValue={editing?.proposalFileName ?? ''} />
            </div>
            <div>
              <Label htmlFor="proposalFileUrl">Proposal file link</Label>
              <Input
                id="proposalFileUrl"
                name="proposalFileUrl"
                type="url"
                defaultValue={editing?.proposalFileUrl ?? ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="referenceNotes">References</Label>
            <Input id="referenceNotes" name="referenceNotes" defaultValue={editing?.referenceNotes ?? ''} />
          </div>

          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea id="remarks" name="remarks" rows={2} defaultValue={editing?.remarks ?? ''} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreating(false)
                setEditing(null)
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save changes' : 'Add project'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
