'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertTriangle, MessageSquareQuote, LineChart, Megaphone, Clock } from 'lucide-react'
import { KPI_MILESTONE_LABELS } from '@/lib/kpi-checks-labels'
import {
  FEEDBACK_WINDOWS,
  FEEDBACK_WINDOW_LABELS,
  RESPONSE_STATUS_LABELS,
  type PerformanceRow,
  type FeedbackWindow,
  type FeedbackCell,
  type KpiCell,
} from '@/lib/performance-fields'
import { saveClientFeedback, setKpiCheckCompleted } from '@/app/(dashboard)/performance/actions'

const RESPONSE_STATUSES = ['NOT_SENT', 'AWAITING_RESPONSE', 'RESPONDED', 'NO_RESPONSE', 'DECLINED'] as const

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

function daysBetween(a: string, b: string) {
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((new Date(`${a}T00:00:00.000Z`).getTime() - new Date(`${b}T00:00:00.000Z`).getTime()) / msPerDay)
}

export function PerformanceBoard({
  rows,
  canMutate,
  showDepartment,
}: {
  rows: PerformanceRow[]
  canMutate: boolean
  showDepartment: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ row: PerformanceRow; window: FeedbackWindow } | null>(null)
  const [saving, setSaving] = useState(false)
  const [editingKpi, setEditingKpi] = useState<{ row: PerformanceRow; check: KpiCell } | null>(null)
  const [kpiCompletedChecked, setKpiCompletedChecked] = useState(false)
  const [kpiDateValue, setKpiDateValue] = useState('')
  const [savingKpi, setSavingKpi] = useState(false)
  const [search, setSearch] = useState('')
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [awaitingRelayOnly, setAwaitingRelayOnly] = useState(false)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (overdueOnly && r.kpiOverdue === 0) return false
      if (awaitingRelayOnly && !FEEDBACK_WINDOWS.some((w) => r.feedback[w].awaitingRelay)) return false
      if (!q) return true
      return (
        r.vaName.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.teamName ?? '').toLowerCase().includes(q) ||
        (r.personInChargeName ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, overdueOnly, awaitingRelayOnly])

  const overdueCount = rows.filter((r) => r.kpiOverdue > 0).length
  const awaitingRelayCount = rows.filter((r) =>
    FEEDBACK_WINDOWS.some((w) => r.feedback[w].awaitingRelay)
  ).length

  const openKpiModal = (row: PerformanceRow, check: KpiCell) => {
    setEditingKpi({ row, check })
    setKpiCompletedChecked(check.completed)
    setKpiDateValue(toDateInput(check.completedAt) || toDateInput(new Date().toISOString()))
  }

  const kpiDueInput = editingKpi ? toDateInput(editingKpi.check.dueDate) : ''
  const kpiDayDiff = kpiCompletedChecked && kpiDateValue && kpiDueInput ? daysBetween(kpiDateValue, kpiDueInput) : null
  const kpiIsLate = kpiDayDiff !== null && kpiDayDiff > 0

  const onSubmitKpi = async (formData: FormData) => {
    if (!editingKpi) return
    setSavingKpi(true)
    try {
      const res = await setKpiCheckCompleted(editingKpi.check.id, formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success(res?.late ? 'Check-in saved — flagged as late' : 'Check-in saved')
      setEditingKpi(null)
      router.refresh()
    } finally {
      setSavingKpi(false)
    }
  }

  const onSubmit = async (formData: FormData) => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await saveClientFeedback(editing.row.assignmentId, editing.window, formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Client feedback saved')
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
          placeholder="Search VA, client, team, person in-charge..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        {overdueCount > 0 && (
          <Button
            variant={overdueOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setOverdueOnly((v) => !v)}
          >
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Overdue check-ins ({overdueCount})
          </Button>
        )}
        {awaitingRelayCount > 0 && (
          <Button
            variant={awaitingRelayOnly ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAwaitingRelayOnly((v) => !v)}
          >
            <Megaphone className="h-3.5 w-3.5 mr-1.5" />
            Feedback not relayed ({awaitingRelayCount})
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {rows.length}
        </span>
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <LineChart className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? 'No engagements to monitor yet.' : 'No engagements match these filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>VA / Client</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Start</TableHead>
                <TableHead>KPI check-ins</TableHead>
                {FEEDBACK_WINDOWS.map((w) => (
                  <TableHead key={w}>{FEEDBACK_WINDOW_LABELS[w]} feedback</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.assignmentId}>
                  <TableCell className="max-w-xs">
                    <Link href={`/vas/${r.vaProfileId}`} className="font-medium hover:text-primary">
                      {r.vaName}
                    </Link>
                    <div className="text-xs text-muted-foreground">{r.clientName}</div>
                    <div className="text-xs text-muted-foreground/70">
                      {[r.teamName, r.expertiseGroup].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  {showDepartment && (
                    <TableCell className="text-muted-foreground">{r.departmentName ?? '—'}</TableCell>
                  )}
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatDate(r.startDate)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {r.kpi.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          disabled={!canMutate}
                          onClick={() => openKpiModal(r, c)}
                          title={`${KPI_MILESTONE_LABELS[c.milestone]} · due ${formatDate(c.dueDate)}${
                            c.completed
                              ? c.late
                                ? ` · checked ${formatDate(c.completedAt)} (late)`
                                : ` · checked ${formatDate(c.completedAt)} (on time)`
                              : c.overdue
                                ? ' · overdue'
                                : ''
                          }`}
                          aria-label={`${KPI_MILESTONE_LABELS[c.milestone]} check-in`}
                          className={`h-6 w-7 rounded text-[10px] font-semibold border transition-colors disabled:cursor-default ${
                            c.completed
                              ? c.late
                                ? 'bg-destructive/15 text-destructive border-destructive/30'
                                : 'bg-success/15 text-success border-success/30'
                              : c.overdue
                                ? 'bg-warning/10 text-warning border-warning/30'
                                : 'bg-transparent text-muted-foreground border-muted-foreground/25 hover:border-muted-foreground/50'
                          }`}
                        >
                          {c.milestone}
                        </button>
                      ))}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {r.kpiDone} / {r.kpi.length} done
                      {r.kpiOverdue > 0 && <span className="text-warning"> &middot; {r.kpiOverdue} overdue</span>}
                      {r.kpi.some((c) => c.late) && (
                        <span className="text-destructive">
                          {' '}
                          &middot; {r.kpi.filter((c) => c.late).length} late
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {FEEDBACK_WINDOWS.map((w) => (
                    <TableCell key={w}>
                      <FeedbackSummary
                        cell={r.feedback[w]}
                        canMutate={canMutate}
                        onEdit={() => setEditing({ row: r, window: w })}
                      />
                    </TableCell>
                  ))}
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
        title={
          editing
            ? `${FEEDBACK_WINDOW_LABELS[editing.window]} feedback — ${editing.row.vaName}`
            : ''
        }
        description={editing ? editing.row.clientName : undefined}
        size="md"
      >
        {editing && (
          <form action={onSubmit} className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="requested"
                name="requested"
                type="checkbox"
                defaultChecked={editing.row.feedback[editing.window].requested}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="requested" className="mb-0">
                Feedback is in scope for this engagement
              </Label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="emailSentAt">Performance email sent</Label>
                <Input
                  id="emailSentAt"
                  name="emailSentAt"
                  type="date"
                  defaultValue={toDateInput(editing.row.feedback[editing.window].emailSentAt)}
                />
              </div>
              <div>
                <Label htmlFor="responseStatus">Client response</Label>
                <Select
                  id="responseStatus"
                  name="responseStatus"
                  defaultValue={editing.row.feedback[editing.window].responseStatus}
                  className="w-full"
                >
                  {RESPONSE_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {RESPONSE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="receivedAt">Feedback received</Label>
              <Input
                id="receivedAt"
                name="receivedAt"
                type="date"
                defaultValue={toDateInput(editing.row.feedback[editing.window].receivedAt)}
              />
            </div>

            <div>
              <Label htmlFor="feedback">Feedback</Label>
              <Textarea
                id="feedback"
                name="feedback"
                rows={4}
                defaultValue={editing.row.feedback[editing.window].feedback ?? ''}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Required once the client has responded.
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="relayedToVa"
                name="relayedToVa"
                type="checkbox"
                defaultChecked={editing.row.feedback[editing.window].relayedToVa}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="relayedToVa" className="mb-0">
                Relayed to the VA
                {editing.row.feedback[editing.window].relayedAt && (
                  <span className="text-muted-foreground font-normal">
                    {' '}
                    &middot; {formatDate(editing.row.feedback[editing.window].relayedAt)}
                  </span>
                )}
              </Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        open={editingKpi !== null}
        onOpenChange={(next) => {
          if (!next) setEditingKpi(null)
        }}
        title={
          editingKpi
            ? `${KPI_MILESTONE_LABELS[editingKpi.check.milestone]} check-in — ${editingKpi.row.vaName}`
            : ''
        }
        description={editingKpi ? editingKpi.row.clientName : undefined}
        size="sm"
      >
        {editingKpi && (
          <form action={onSubmitKpi} className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Due {formatDate(editingKpi.check.dueDate)}
            </p>

            <div className="flex items-center gap-2">
              <input
                id="completed"
                name="completed"
                type="checkbox"
                checked={kpiCompletedChecked}
                onChange={(e) => setKpiCompletedChecked(e.target.checked)}
                className="h-4 w-4 rounded border-input"
              />
              <Label htmlFor="completed" className="mb-0">
                Checked in
              </Label>
            </div>

            <div>
              <Label htmlFor="completedAt">Date checked</Label>
              <Input
                id="completedAt"
                name="completedAt"
                type="date"
                value={kpiDateValue}
                onChange={(e) => setKpiDateValue(e.target.value)}
                disabled={!kpiCompletedChecked}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Pick the day the check-in actually happened — it doesn&apos;t have to be today.
              </p>
            </div>

            {kpiCompletedChecked && kpiDayDiff !== null && (
              <div
                className={`flex items-center gap-1.5 text-xs rounded-md px-2 py-1.5 ${
                  kpiIsLate ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                }`}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                {kpiIsLate
                  ? `Checked ${kpiDayDiff} day${kpiDayDiff === 1 ? '' : 's'} after the due date — flagged as late.`
                  : kpiDayDiff < 0
                    ? `Checked ${Math.abs(kpiDayDiff)} day${kpiDayDiff === -1 ? '' : 's'} before the due date.`
                    : 'Checked on the due date — on time.'}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingKpi(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingKpi}>
                {savingKpi ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  )
}

function FeedbackSummary({
  cell,
  canMutate,
  onEdit,
}: {
  cell: FeedbackCell
  canMutate: boolean
  onEdit: () => void
}) {
  const body = !cell.requested ? (
    <span className="text-xs text-muted-foreground">Not in scope</span>
  ) : (
    <div className="space-y-0.5">
      <Badge variant={cell.responseStatus === 'RESPONDED' ? 'secondary' : 'outline'} className="text-xs">
        {RESPONSE_STATUS_LABELS[cell.responseStatus] ?? cell.responseStatus}
      </Badge>
      {cell.feedback && (
        <div className="text-xs text-muted-foreground line-clamp-2 max-w-[14rem]" title={cell.feedback}>
          <MessageSquareQuote className="h-3 w-3 inline mr-1" />
          {cell.feedback}
        </div>
      )}
      {cell.awaitingRelay && (
        <div className="flex items-center gap-1 text-xs text-warning">
          <Megaphone className="h-3 w-3" />
          Not relayed to VA
        </div>
      )}
      {cell.relayedToVa && <div className="text-xs text-success">Relayed {formatDate(cell.relayedAt)}</div>}
    </div>
  )

  if (!canMutate) return body

  return (
    <button
      type="button"
      onClick={onEdit}
      className="text-left w-full rounded px-1 -mx-1 py-0.5 hover:bg-muted/60"
      aria-label="Edit client feedback"
    >
      {body}
    </button>
  )
}
