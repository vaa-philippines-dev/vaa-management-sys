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
import { Pencil, ExternalLink, AlertTriangle, CheckCircle2, Circle, ClipboardList } from 'lucide-react'
import {
  CHECKLIST_FIELDS,
  PIPELINE_STEPS,
  START_STATUS_LABELS,
  VA_TYPE_LABELS,
  STEP_STATUS_LABELS,
  CLIENT_STATUS_LABELS,
  type PreparationRow,
} from '@/lib/va-preparation-fields'
import { updatePreparation, toggleChecklistItem, setStepStatus } from '@/app/(dashboard)/va-preparation/actions'

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

  const onToggle = async (prep: PreparationRow, field: string, next: boolean) => {
    const res = await toggleChecklistItem(prep.id, field, next)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    router.refresh()
  }

  const onStep = async (prep: PreparationRow, step: string, status: string) => {
    const res = await setStepStatus(prep.id, step, status as never)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success('Pipeline updated')
    router.refresh()
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
                    <div className="flex flex-col gap-0.5">
                      {PIPELINE_STEPS.map((step) => {
                        const status = p[step.statusField] as string
                        const date = p[step.dateField] as string | null
                        const done = status === 'DONE'
                        return (
                          <button
                            key={step.key}
                            type="button"
                            disabled={!canMutate}
                            onClick={() => onStep(p, step.key, done ? 'PENDING' : 'DONE')}
                            className="flex items-center gap-1.5 text-xs text-left disabled:cursor-default hover:opacity-70"
                            title={
                              canMutate
                                ? `${step.label}: ${STEP_STATUS_LABELS[status as keyof typeof STEP_STATUS_LABELS]} — click to toggle`
                                : `${step.label}: ${STEP_STATUS_LABELS[status as keyof typeof STEP_STATUS_LABELS]}`
                            }
                          >
                            {done ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            <span className={done ? 'text-muted-foreground' : ''}>{step.label}</span>
                            {date && <span className="text-muted-foreground/60">{formatDate(date)}</span>}
                          </button>
                        )
                      })}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="text-xs font-medium">
                        {p.checklistDone} / {CHECKLIST_FIELDS.length}
                      </div>
                      <div className="grid grid-cols-3 gap-0.5 w-max">
                        {CHECKLIST_FIELDS.map((f) => (
                          <button
                            key={f.key}
                            type="button"
                            disabled={!canMutate}
                            onClick={() => onToggle(p, f.key, !p.checklist[f.key])}
                            title={`${f.label}: ${p.checklist[f.key] ? 'done' : 'not done'}`}
                            aria-label={f.label}
                            className={`h-3 w-3 rounded-sm border disabled:cursor-default ${
                              p.checklist[f.key]
                                ? 'bg-success/70 border-success/70'
                                : 'bg-transparent border-muted-foreground/30 hover:border-muted-foreground/60'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
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
                        onClick={() => setEditing(p)}
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
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="startStatus">Department status</Label>
                  <Select id="startStatus" name="startStatus" defaultValue={editing.startStatus} className="w-full">
                    {Object.entries(START_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="vaType">VA type</Label>
                  <Select id="vaType" name="vaType" defaultValue={editing.vaType} className="w-full">
                    {Object.entries(VA_TYPE_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label htmlFor="targetStartDate">Target start date</Label>
                  <Input
                    id="targetStartDate"
                    name="targetStartDate"
                    type="date"
                    defaultValue={toDateInput(editing.targetStartDate)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="scheduleType">Schedule type</Label>
                  <Input
                    id="scheduleType"
                    name="scheduleType"
                    placeholder="Flexible / Fixed"
                    defaultValue={editing.scheduleType ?? ''}
                  />
                </div>
                <div>
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
                <div>
                  <Label htmlFor="expertiseGroup">Expertise group</Label>
                  <Input id="expertiseGroup" name="expertiseGroup" defaultValue={editing.expertiseGroup ?? ''} />
                </div>
                <div>
                  <Label htmlFor="vaBuffers">VA buffers</Label>
                  <Input id="vaBuffers" name="vaBuffers" defaultValue={editing.vaBuffers ?? ''} />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
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
                <div>
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
                <div>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="vaClientFileUrl">VA-Client file link</Label>
                  <Input
                    id="vaClientFileUrl"
                    name="vaClientFileUrl"
                    type="url"
                    defaultValue={editing.vaClientFileUrl ?? ''}
                  />
                </div>
                <div>
                  <Label htmlFor="accountDocUrl">Account doc link</Label>
                  <Input
                    id="accountDocUrl"
                    name="accountDocUrl"
                    type="url"
                    defaultValue={editing.accountDocUrl ?? ''}
                  />
                </div>
              </div>
            </section>

            <section className="space-y-3 border-t pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Schedule</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="preparationStartDate">Preparation start</Label>
                  <Input
                    id="preparationStartDate"
                    name="preparationStartDate"
                    type="date"
                    defaultValue={toDateInput(editing.preparationStartDate)}
                  />
                </div>
                <div>
                  <Label htmlFor="preparationEndDate">Preparation end</Label>
                  <Input
                    id="preparationEndDate"
                    name="preparationEndDate"
                    type="date"
                    defaultValue={toDateInput(editing.preparationEndDate)}
                  />
                </div>
              </div>

              {PIPELINE_STEPS.map((step) => (
                <div key={step.key} className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={step.dateField}>{step.label} date</Label>
                    <Input
                      id={step.dateField}
                      name={step.dateField}
                      type="date"
                      defaultValue={toDateInput(editing[step.dateField] as string | null)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={step.statusField}>{step.label} status</Label>
                    <Select
                      id={step.statusField}
                      name={step.statusField}
                      defaultValue={editing[step.statusField] as string}
                      className="w-full"
                    >
                      {Object.entries(STEP_STATUS_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              ))}
            </section>

            <section className="space-y-3 border-t pt-3">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                EOC / Replacement
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
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
                <div>
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

              <div>
                <Label htmlFor="statusReason">Reason</Label>
                <Input id="statusReason" name="statusReason" defaultValue={editing.statusReason ?? ''} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="replacementNote">Replacement note</Label>
                  <Textarea
                    id="replacementNote"
                    name="replacementNote"
                    rows={2}
                    defaultValue={editing.replacementNote ?? ''}
                  />
                </div>
                <div>
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
