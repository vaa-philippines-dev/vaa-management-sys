'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, Trash2, Settings2 } from 'lucide-react'
import { saveLeaveApprovalRule, type StepInput } from '@/app/(dashboard)/admin/leave-hierarchy/actions'
import { ROLE_LABELS } from '@/lib/leave-roles'

type UserOption = { id: string; firstName: string; lastName: string; email: string; systemRole: string }
type RoleEntry = {
  role: string
  label: string
  rule: { isActive: boolean; steps: StepInput[] } | null
}

const RESOLUTION_LABELS: Record<StepInput['resolution'], string> = {
  DEPARTMENT_HEAD: "Requester's Department Head",
  ROLE: 'Any user with role...',
  SPECIFIC_USER: 'Specific person...',
}

function stepSummary(step: StepInput, users: UserOption[]): string {
  if (step.resolution === 'DEPARTMENT_HEAD') return "Department Head"
  if (step.resolution === 'ROLE') return `All ${ROLE_LABELS[step.approverRole ?? ''] ?? step.approverRole}`
  const u = users.find((u) => u.id === step.approverUserId)
  return u ? `${u.firstName} ${u.lastName}` : 'Unassigned person'
}

export function LeaveHierarchyManager({ roles, users }: { roles: RoleEntry[]; users: UserOption[] }) {
  const [editing, setEditing] = useState<RoleEntry | null>(null)

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {roles.map((entry) => (
        <div key={entry.role} className="rounded-lg border bg-card p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">{entry.label}</p>
              {entry.rule && entry.rule.steps.length > 0 ? (
                <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5 bg-success/15 text-success border-success/20">
                  Configured
                </Badge>
              ) : (
                <Badge variant="outline" className="mt-1 text-[10px] py-0 px-1.5 bg-warning/15 text-warning border-warning/20">
                  Not configured
                </Badge>
              )}
            </div>
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditing(entry)}>
              <Settings2 className="h-3 w-3" />
              Manage
            </Button>
          </div>

          {entry.rule && entry.rule.steps.length > 0 && (
            <ol className="space-y-1 text-xs text-muted-foreground">
              {[...new Set(entry.rule.steps.map((s) => s.order))].sort((a, b) => a - b).map((order) => {
                const rows = entry.rule!.steps.filter((s) => s.order === order)
                return (
                  <li key={order}>
                    <span className="font-medium text-foreground">Step {order}:</span>{' '}
                    {rows.map((r) => stepSummary(r, users)).join(' + ')}
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      ))}

      {editing && (
        <EditRuleModal
          key={editing.role}
          entry={editing}
          users={users}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function EditRuleModal({ entry, users, onClose }: { entry: RoleEntry; users: UserOption[]; onClose: () => void }) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [isActive, setIsActive] = useState(entry.rule?.isActive ?? true)
  const [steps, setSteps] = useState<StepInput[]>(entry.rule?.steps ?? [])
  const [saving, setSaving] = useState(false)

  const updateStep = (index: number, patch: Partial<StepInput>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addStep = () => {
    const maxOrder = steps.reduce((m, s) => Math.max(m, s.order), 0)
    setSteps((prev) => [...prev, { order: maxOrder + 1, resolution: 'DEPARTMENT_HEAD', approverRole: null, approverUserId: null, requireAll: true }])
  }

  const removeStep = (index: number) => setSteps((prev) => prev.filter((_, i) => i !== index))

  const handleSave = async () => {
    setSaving(true)
    try {
      const r = await saveLeaveApprovalRule(entry.role, isActive, steps)
      if (r?.error) {
        toast.error(r.error)
        return
      }
      toast.success(`${entry.label} approval hierarchy saved`)
      onClose()
      startTransition(() => router.refresh())
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onOpenChange={(open) => !open && onClose()}
      title={`${entry.label} — Approval Hierarchy`}
      description="Steps run in order. Approvers within the same step number act in parallel."
      size="lg"
      footer={
        <>
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Hierarchy'}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active (leave requests from this role will route through this hierarchy)
        </label>

        {steps.length === 0 && (
          <p className="text-xs text-muted-foreground rounded-lg border border-dashed p-4 text-center">
            No steps yet — staff with this role can&apos;t submit leave until at least one step is added.
          </p>
        )}

        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="rounded-lg border p-3 space-y-2 bg-muted/20">
              <div className="grid grid-cols-[64px_1fr_auto] gap-2 items-end">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Step</label>
                  <Input
                    type="number"
                    min={1}
                    value={step.order}
                    onChange={(e) => updateStep(i, { order: Number(e.target.value) || 1 })}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block">Approver</label>
                  <Select
                    value={step.resolution}
                    onChange={(e) =>
                      updateStep(i, {
                        resolution: e.target.value as StepInput['resolution'],
                        approverRole: null,
                        approverUserId: null,
                      })
                    }
                    className="h-8 text-xs"
                  >
                    {(Object.keys(RESOLUTION_LABELS) as StepInput['resolution'][]).map((r) => (
                      <option key={r} value={r}>{RESOLUTION_LABELS[r]}</option>
                    ))}
                  </Select>
                </div>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => removeStep(i)} title="Remove step">
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>

              {step.resolution === 'ROLE' && (
                <Select
                  value={step.approverRole ?? ''}
                  onChange={(e) => updateStep(i, { approverRole: e.target.value })}
                  className="h-8 text-xs"
                >
                  <option value="" disabled>Select a role...</option>
                  {Object.entries(ROLE_LABELS).map(([role, label]) => (
                    <option key={role} value={role}>{label}</option>
                  ))}
                </Select>
              )}

              {step.resolution === 'SPECIFIC_USER' && (
                <Select
                  value={step.approverUserId ?? ''}
                  onChange={(e) => updateStep(i, { approverUserId: e.target.value })}
                  className="h-8 text-xs"
                >
                  <option value="" disabled>Select a person...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({ROLE_LABELS[u.systemRole] ?? u.systemRole})</option>
                  ))}
                </Select>
              )}

              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input type="checkbox" checked={step.requireAll} onChange={(e) => updateStep(i, { requireAll: e.target.checked })} />
                Require all resolved approvers to approve (uncheck: any one is enough)
              </label>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={addStep}>
          <Plus className="h-3.5 w-3.5" />
          Add Step
        </Button>
      </div>
    </Modal>
  )
}
