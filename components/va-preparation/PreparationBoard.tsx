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
import { Progress } from '@/components/ui/progress'
import {
  Pencil,
  ExternalLink,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  Check,
  ClipboardList,
} from 'lucide-react'
import {
  CHECKLIST_FIELDS,
  PIPELINE_STEPS,
  START_STATUS_LABELS,
  VA_TYPE_LABELS,
  STEP_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
  type PreparationRow,
  type ChecklistKey,
} from '@/lib/va-preparation-fields'
import { updatePreparation } from '@/app/(dashboard)/va-preparation/actions'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(d)
}

function toDateInput(iso: string | null) {
  return iso ? iso.slice(0, 10) : ''
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  NOT_YET_STARTED: 'outline',
  STARTED_ON_TIME: 'secondary',
  DELAYED: 'destructive',
  CANCELLED: 'outline',
}

const STEP_STATUS_STYLE: Record<
  string,
  { icon: typeof CheckCircle2; iconClassName: string; nodeClassName: string }
> = {
  DONE: {
    icon: CheckCircle2,
    iconClassName: 'text-success',
    nodeClassName: 'bg-success/15 border-success',
  },
  SCHEDULED: {
    icon: Clock,
    iconClassName: 'text-info',
    nodeClassName: 'bg-info/15 border-info',
  },
  SKIPPED: {
    icon: XCircle,
    iconClassName: 'text-muted-foreground',
    nodeClassName: 'bg-muted border-muted-foreground/30',
  },
  PENDING: {
    icon: Circle,
    iconClassName: 'text-muted-foreground/40',
    nodeClassName: 'bg-background border-muted-foreground/30',
  },
}

function ReadOnlyLink({ href }: { href: string | null }) {
  if (!href) return <p className="text-sm py-2 text-muted-foreground">Not set</p>
  return (
    <p className="py-2">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ExternalLink className="h-3.5 w-3.5" />
        View file
      </a>
    </p>
  )
}

export function PreparationBoard({
  preparations,
  people,
  vaProfiles,
  canMutate,
  showDepartment,
}: {
  preparations: PreparationRow[]
  people: { id: string; name: string }[]
  vaProfiles: { id: string; name: string }[]
  canMutate: boolean
  showDepartment: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<PreparationRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [pipelineStatuses, setPipelineStatuses] = useState<Record<string, string>>({})
  const [checklistState, setChecklistState] = useState<Record<ChecklistKey, boolean>>(
    {} as Record<ChecklistKey, boolean>
  )
  const [search, setSearch] = useState('')
  const [startFilter, setStartFilter] = useState('')
  const [clientStatusFilter, setClientStatusFilter] = useState('')
  const [issuesOnly, setIssuesOnly] = useState(false)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return preparations.filter((p) => {
      if (startFilter && p.startStatus !== startFilter) return false
      if (clientStatusFilter && p.clientStatus !== clientStatusFilter) return false
      if (issuesOnly && !p.missingEffectivityDate) return false
      if (!q) return true
      return (
        p.vaName.toLowerCase().includes(q) ||
        p.clientName.toLowerCase().includes(q) ||
        (p.teamName ?? '').toLowerCase().includes(q) ||
        (p.expertiseGroup ?? '').toLowerCase().includes(q)
      )
    })
  }, [preparations, search, startFilter, clientStatusFilter, issuesOnly])

  const issueCount = preparations.filter((p) => p.missingEffectivityDate).length

  const openEditor = (prep: PreparationRow) => {
    setEditing(prep)
    setPipelineStatuses(
      Object.fromEntries(PIPELINE_STEPS.map((step) => [step.key, prep[step.statusField] as string]))
    )
    setChecklistState({ ...prep.checklist })
  }

  const onSubmit = async (formData: FormData) => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await updatePreparation(editing.id, formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Preparation updated')
      setEditing(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search VA, client, team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={startFilter} onChange={(e) => setStartFilter(e.target.value)} className="w-44">
          <option value="">All start statuses</option>
          {Object.entries(START_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          value={clientStatusFilter}
          onChange={(e) => setClientStatusFilter(e.target.value)}
          className="w-40"
        >
          <option value="">All VA statuses</option>
          {Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {issueCount > 0 && (
          <Button
            variant={issuesOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIssuesOnly((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Missing EOC/pause date ({issueCount})
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {preparations.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {preparations.length === 0
              ? 'No preparation records yet — one opens automatically with every new assignment.'
              : 'No records match these filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>VA / Client</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Type</TableHead>
                <TableHead>Target / Actual</TableHead>
                <TableHead>Pipeline</TableHead>
                <TableHead>Checklist</TableHead>
                <TableHead>VA Status</TableHead>
                {canMutate && <TableHead className="w-12"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="max-w-xs">
                    <div className="font-medium">{p.vaName}</div>
                    <div className="text-xs text-muted-foreground">{p.clientName}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.teamName && <span className="text-xs text-muted-foreground">{p.teamName}</span>}
                      {p.vaClientFileUrl && (
                        <a
                          href={p.vaClientFileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="h-3 w-3" />
                          VA-Client file
                        </a>
                      )}
                    </div>
                  </TableCell>
                  {showDepartment && (
                    <TableCell className="text-muted-foreground">{p.departmentName ?? '—'}</TableCell>
                  )}
                  <TableCell>
                    <div className="space-y-1">
                      <Badge variant={STATUS_VARIANT[p.startStatus] ?? 'outline'}>
                        {START_STATUS_LABELS[p.startStatus]}
                      </Badge>
                      <div className="text-xs text-muted-foreground">{VA_TYPE_LABELS[p.vaType]}</div>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    <div>Target: {formatDate(p.targetStartDate)}</div>
                    <div>Actual: {formatDate(p.actualStartDate)}</div>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => openEditor(p)}
                      className="flex flex-col gap-0.5 text-left disabled:cursor-default group"
                    >
                      {PIPELINE_STEPS.map((step) => {
                        const status = p[step.statusField] as string
                        const date = p[step.dateField] as string | null
                        const style = STEP_STATUS_STYLE[status] ?? STEP_STATUS_STYLE.PENDING
                        const StepIcon = style.icon
                        const done = status === 'DONE'
                        return (
                          <span
                            key={step.key}
                            className="flex items-center gap-1.5 text-xs"
                            title={`${step.label}: ${STEP_STATUS_LABELS[status as keyof typeof STEP_STATUS_LABELS]}${canMutate ? ' — click to edit' : ''}`}
                          >
                            <StepIcon className={`h-3.5 w-3.5 shrink-0 ${style.iconClassName}`} />
                            <span className={done ? 'text-muted-foreground' : ''}>{step.label}</span>
                            {date && <span className="text-muted-foreground/60">{formatDate(date)}</span>}
                          </span>
                        )
                      })}
                      {canMutate && (
                        <span className="text-xs text-primary/0 group-hover:text-primary/70 transition-colors">
                          Edit pipeline →
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      type="button"
                      disabled={!canMutate}
                      onClick={() => openEditor(p)}
                      className="flex flex-col gap-1 text-left disabled:cursor-default group"
                    >
                      <div className="text-xs font-medium">
                        {p.checklistDone} / {CHECKLIST_FIELDS.length}
                      </div>
                      <div className="grid grid-cols-3 gap-0.5 w-max">
                        {CHECKLIST_FIELDS.map((f) => (
                          <span
                            key={f.key}
                            title={`${f.label}: ${p.checklist[f.key] ? 'done' : 'not done'}`}
                            className={`h-3 w-3 rounded-sm border ${
                              p.checklist[f.key]
                                ? 'bg-success/70 border-success/70'
                                : 'bg-transparent border-muted-foreground/30'
                            }`}
                          />
                        ))}
                      </div>
                      {canMutate && (
                        <span className="text-xs text-primary/0 group-hover:text-primary/70 transition-colors">
                          Edit checklist →
                        </span>
                      )}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-0.5">
                      <Badge variant={p.clientStatus === 'ACTIVE' ? 'secondary' : 'outline'}>
                        {CLIENT_STATUS_LABELS[p.clientStatus]}
                      </Badge>
                      {p.clientStatus !== 'ACTIVE' &&
                        (p.missingEffectivityDate ? (
                          <div className="flex items-center gap-1 text-xs text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            No effectivity date
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">
                            {formatDate(p.effectivityDate)}
                          </div>
                        ))}
                    </div>
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEditor(p)}
                        aria-label="Edit preparation"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        title={editing ? `${editing.vaName} — ${editing.clientName}` : ''}
        description="VA Preparation record"
        size="lg"
      >
        {editing && (
          <form action={onSubmit} className="space-y-4">
            <section className="space-y-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Setup</h4>
              {/* Department status / VA type / Target start date are fixed/
                  fetched per the sheet's own column coding, not DM/OM-
                  editable — same as Expertise group / VA-Client file /
                  Account doc below. Only ever populated by the DMF import. */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Department status</Label>
                  <p className="text-sm py-2">
                    <Badge variant={STATUS_VARIANT[editing.startStatus] ?? 'outline'}>
                      {START_STATUS_LABELS[editing.startStatus]}
                    </Badge>
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">VA type</Label>
                  <p className="text-sm py-2">{VA_TYPE_LABELS[editing.vaType]}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Target start date</Label>
                  <p className="text-sm py-2">{formatDate(editing.targetStartDate)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="scheduleType">Schedule type</Label>
                  <Input
                    id="scheduleType"
                    name="scheduleType"
                    placeholder="Flexible / Fixed"
                    defaultValue={editing.scheduleType ?? ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scheduleDays">Schedule days</Label>
                  <Input
                    id="scheduleDays"
                    name="scheduleDays"
                    placeholder="Mon - Fri"
                    defaultValue={editing.scheduleDays ?? ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  {/* Fixed/fetched per the sheet's own column coding, not
                      DM/OM-editable — same as VA Name/Team/Primary Account.
                      Only ever populated by the DMF import. */}
                  <Label className="text-muted-foreground">Expertise group</Label>
                  <p className="text-sm py-2">{editing.expertiseGroup || <span className="text-muted-foreground">Not set</span>}</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="vaBuffers">VA buffers</Label>
                  <Input id="vaBuffers" name="vaBuffers" defaultValue={editing.vaBuffers ?? ''} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="personInChargeId">Person in-charge</Label>
                  <Select
                    id="personInChargeId"
                    name="personInChargeId"
                    defaultValue={editing.personInChargeId ?? ''}
                    className="w-full"
                  >
                    <option value="">Unassigned</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shadowTrainerId">Shadow trainer</Label>
                  <Select
                    id="shadowTrainerId"
                    name="shadowTrainerId"
                    defaultValue={editing.shadowTrainerId ?? ''}
                    className="w-full"
                  >
                    <option value="">Unassigned</option>
                    {people.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="replacementForId">Replacement for</Label>
                  <Select
                    id="replacementForId"
                    name="replacementForId"
                    defaultValue={editing.replacementForId ?? ''}
                    className="w-full"
                  >
                    <option value="">—</option>
                    {vaProfiles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              {/* VA-Client file / Account doc are fixed/fetched per the
                  sheet's own column coding, not DM/OM-editable — display
                  only, same as Expertise Group above. Only ever populated by
                  the DMF import. */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">VA-Client file link</Label>
                  <ReadOnlyLink href={editing.vaClientFileUrl} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-muted-foreground">Account doc link</Label>
                  <ReadOnlyLink href={editing.accountDocUrl} />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="preparationStartDate">Preparation start</Label>
                  <Input
                    id="preparationStartDate"
                    name="preparationStartDate"
                    type="date"
                    defaultValue={toDateInput(editing.preparationStartDate)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="preparationEndDate">Preparation end</Label>
                  <Input
                    id="preparationEndDate"
                    name="preparationEndDate"
                    type="date"
                    defaultValue={toDateInput(editing.preparationEndDate)}
                  />
                </div>
              </div>

              <div>
                {PIPELINE_STEPS.map((step, idx) => {
                  const status = pipelineStatuses[step.key] ?? (editing[step.statusField] as string)
                  const style = STEP_STATUS_STYLE[status] ?? STEP_STATUS_STYLE.PENDING
                  const StepIcon = style.icon
                  return (
                    <div key={step.key} className="relative flex gap-3">
                      {idx < PIPELINE_STEPS.length - 1 && (
                        <span
                          className="absolute left-[15px] top-8 bottom-0 w-px bg-muted-foreground/20"
                          aria-hidden
                        />
                      )}
                      <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 z-10 transition-colors ${style.nodeClassName}`}
                      >
                        <StepIcon className={`h-4 w-4 ${style.iconClassName}`} />
                      </div>
                      <div className="flex-1 rounded-lg border bg-muted/30 p-3 mb-3 space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <Label htmlFor={step.statusField} className="text-sm font-medium">
                            {step.label}
                          </Label>
                          <Select
                            id={step.statusField}
                            name={step.statusField}
                            defaultValue={status}
                            onChange={(e) =>
                              setPipelineStatuses((prev) => ({ ...prev, [step.key]: e.target.value }))
                            }
                            className="w-36 h-8 text-xs"
                          >
                            {Object.entries(STEP_STATUS_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={step.dateField} className="text-xs text-muted-foreground shrink-0">
                            Date
                          </Label>
                          <Input
                            id={step.dateField}
                            name={step.dateField}
                            type="date"
                            defaultValue={toDateInput(editing[step.dateField] as string | null)}
                            className="h-8"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="space-y-3 border-t pt-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Onboarding Checklist
                </h4>
                <span className="text-xs font-medium text-muted-foreground">
                  {Object.values(checklistState).filter(Boolean).length} / {CHECKLIST_FIELDS.length} done
                </span>
              </div>
              <Progress
                value={
                  (Object.values(checklistState).filter(Boolean).length / CHECKLIST_FIELDS.length) * 100
                }
              />
              <div className="grid grid-cols-3 gap-2">
                {CHECKLIST_FIELDS.map((f) => {
                  const checked = checklistState[f.key] ?? false
                  return (
                    <label
                      key={f.key}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                        checked
                          ? 'bg-success/15 border-success/60'
                          : 'bg-muted/30 border-muted-foreground/20 hover:border-muted-foreground/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        name={f.key}
                        checked={checked}
                        onChange={(e) =>
                          setChecklistState((prev) => ({ ...prev, [f.key]: e.target.checked }))
                        }
                        className="sr-only"
                      />
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                          checked
                            ? 'bg-success border-success text-success-foreground'
                            : 'border-muted-foreground/30 text-transparent'
                        }`}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <span className="text-sm">{f.label}</span>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="space-y-3 border-t pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                EOC / Replacement
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="clientStatus">VA status with client</Label>
                  <Select
                    id="clientStatus"
                    name="clientStatus"
                    defaultValue={editing.clientStatus}
                    className="w-full"
                  >
                    {Object.entries(CLIENT_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="effectivityDate">Effectivity date</Label>
                  <Input
                    id="effectivityDate"
                    name="effectivityDate"
                    type="date"
                    defaultValue={toDateInput(editing.effectivityDate)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Required once the status is Paused or End of Work.
                  </p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="statusReason">Reason</Label>
                <Input id="statusReason" name="statusReason" defaultValue={editing.statusReason ?? ''} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="replacementNote">Replacement note</Label>
                  <Textarea
                    id="replacementNote"
                    name="replacementNote"
                    rows={2}
                    defaultValue={editing.replacementNote ?? ''}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="replacedById">Replaced by</Label>
                  <Select
                    id="replacedById"
                    name="replacedById"
                    defaultValue={editing.replacedById ?? ''}
                    className="w-full"
                  >
                    <option value="">—</option>
                    {vaProfiles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </section>

            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save changes'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}
