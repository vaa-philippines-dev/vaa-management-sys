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
import { Pencil, AlertTriangle, CheckCircle2, Star, CalendarRange, Info } from 'lucide-react'
import {
  ALERT_LABELS,
  AVAILABILITY_REVIEW_DAYS,
  AVAILABILITY_STATUSES,
  AVAILABILITY_STATUS_LABELS,
  WORK_PATTERN_LABELS,
  type AvailabilityRow,
} from '@/lib/va-availability-fields'
import { updateAvailability, confirmAvailability } from '@/app/(dashboard)/va-availability/actions'

const STATUS_LABELS: Record<string, string> = AVAILABILITY_STATUS_LABELS

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

function todayInput() {
  return new Date().toISOString().slice(0, 10)
}

function hours(n: number | null) {
  if (n == null) return '—'
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`
}

export function AvailabilityBoard({
  rows,
  canMutate,
  showDepartment,
  initialAlertsOnly = false,
}: {
  rows: AvailabilityRow[]
  canMutate: boolean
  showDepartment: boolean
  initialAlertsOnly?: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState<AvailabilityRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [freeOnly, setFreeOnly] = useState(false)
  const [recommendedOnly, setRecommendedOnly] = useState(false)
  const [alertsOnly, setAlertsOnly] = useState(initialAlertsOnly)

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (statusFilter && r.availabilityStatus !== statusFilter) return false
      if (freeOnly && r.availableHours <= 0) return false
      if (recommendedOnly && !r.isRecommended) return false
      if (alertsOnly && r.alert === 'NONE') return false
      if (!q) return true
      return (
        r.name.toLowerCase().includes(q) ||
        (r.employeeId ?? '').toLowerCase().includes(q) ||
        (r.position ?? '').toLowerCase().includes(q) ||
        (r.teamName ?? '').toLowerCase().includes(q) ||
        (r.recommendedForClient ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, statusFilter, freeOnly, recommendedOnly, alertsOnly])

  const alertCount = rows.filter((r) => r.alert !== 'NONE').length
  const totalAvailableHours = visible.reduce((s, r) => s + r.availableHours, 0)

  // confirmAvailability() has no validation branch — it either throws (auth
  // or scope) or succeeds — so a thrown error is the only failure to show.
  const onConfirm = async (row: AvailabilityRow) => {
    try {
      await confirmAvailability(row.vaProfileId, row.departmentId)
      toast.success(`${row.name}'s availability re-confirmed`)
      router.refresh()
    } catch {
      toast.error('Could not confirm availability')
    }
  }

  const onSubmit = async (formData: FormData) => {
    if (!editing) return
    setSaving(true)
    try {
      await updateAvailability(editing.vaProfileId, editing.departmentId, formData)
      toast.success('Availability updated')
      setEditing(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update availability')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {canMutate && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            Everything below is read-only — booked hours and client count come from active assignments, the
            rest from HR records and each VA&apos;s Team Leader (their TMF). The only things you can change
            here are <span className="font-medium text-foreground">availability, remarks, and the date changed</span>,
            via <span className="font-medium text-foreground">Change availability</span>.
          </span>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name, ID, position, team..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-44">
          <option value="">All statuses</option>
          {AVAILABILITY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </Select>
        <Button variant={freeOnly ? 'default' : 'outline'} size="sm" onClick={() => setFreeOnly((v) => !v)}>
          Has free hours
        </Button>
        <Button
          variant={recommendedOnly ? 'default' : 'outline'}
          size="sm"
          onClick={() => setRecommendedOnly((v) => !v)}
        >
          <Star className="h-3.5 w-3.5 mr-1.5" />
          Recommended
        </Button>
        {alertCount > 0 && (
          <Button variant={alertsOnly ? 'default' : 'outline'} size="sm" onClick={() => setAlertsOnly((v) => !v)}>
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
            Needs review ({alertCount})
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">
          {visible.length} of {rows.length} &middot; {hours(totalAvailableHours)} free
        </span>
      </div>

      {visible.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <CalendarRange className="h-10 w-10 text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            {rows.length === 0 ? 'No VAs in scope.' : 'No VAs match these filters.'}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow>
                <TableHead>VA</TableHead>
                {showDepartment && <TableHead>Department</TableHead>}
                <TableHead>Pattern</TableHead>
                <TableHead className="text-right">Preferred</TableHead>
                <TableHead className="text-right">Booked</TableHead>
                <TableHead className="text-right">Hybrid</TableHead>
                <TableHead className="text-right">Available</TableHead>
                <TableHead className="text-right">Clients</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Recommended</TableHead>
                <TableHead>Availability update</TableHead>
                <TableHead>TMF</TableHead>
                {canMutate && <TableHead className="w-32"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((r) => (
                <TableRow key={r.rowKey}>
                  <TableCell className="max-w-xs">
                    <Link href={`/vas/${r.vaProfileId}`} className="font-medium hover:text-primary">
                      {r.name}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {[r.employeeId, r.position, r.teamName].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </TableCell>
                  {showDepartment && (
                    <TableCell className="text-muted-foreground">{r.departmentName ?? '—'}</TableCell>
                  )}
                  <TableCell className="text-muted-foreground text-xs">
                    {WORK_PATTERN_LABELS[r.workPattern]}
                  </TableCell>
                  <TableCell className="text-right">{hours(r.preferredHours)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {hours(r.currentHours)}
                    {r.otherDepartmentHours > 0 && (
                      <div className="text-[11px] text-muted-foreground/70" title="Booked with clients in other departments">
                        +{hours(r.otherDepartmentHours)} elsewhere
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{hours(r.hybridHours)}</TableCell>
                  <TableCell
                    className={`text-right font-semibold ${r.availableHours > 0 ? 'text-success' : 'text-muted-foreground'}`}
                  >
                    {hours(r.availableHours)}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{r.clientCount}</TableCell>
                  <TableCell>
                    <Badge variant={r.availabilityStatus === 'AVAILABLE' ? 'secondary' : 'outline'}>
                      {STATUS_LABELS[r.availabilityStatus] ?? r.availabilityStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[10rem]">
                    {r.isRecommended ? (
                      <div className="text-xs">
                        <div className="flex items-center gap-1 text-warning font-medium">
                          <Star className="h-3 w-3 fill-current" />
                          Yes
                        </div>
                        {r.recommendedForClient && (
                          <div className="text-muted-foreground truncate" title={r.recommendedForClient}>
                            {r.recommendedForClient}
                          </div>
                        )}
                        {r.recommendedUntil && (
                          <div className="text-muted-foreground/70">until {r.recommendedUntil}</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[12rem]">
                    <div className="text-xs">{formatDate(r.availabilityChangedAt)}</div>
                    {r.availabilityReviewDueAt && (
                      <div className="text-xs text-muted-foreground">
                        Update due {formatDate(r.availabilityReviewDueAt)}
                      </div>
                    )}
                    {r.availabilityRemarks && (
                      <div className="text-xs text-muted-foreground truncate" title={r.availabilityRemarks}>
                        {r.availabilityRemarks}
                      </div>
                    )}
                    {r.alert !== 'NONE' && (
                      <div className="flex items-center gap-1 text-xs text-warning">
                        <AlertTriangle className="h-3 w-3" />
                        {ALERT_LABELS[r.alert]}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[10rem]">
                    {r.tmfAvailabilityStatus ? (
                      <div className="text-xs">
                        <div className={r.tmfMismatch ? 'text-warning font-medium' : ''}>
                          {STATUS_LABELS[r.tmfAvailabilityStatus] ?? r.tmfAvailabilityStatus}
                        </div>
                        <div className="text-muted-foreground">{formatDate(r.tmfChangedAt)}</div>
                        {r.tmfMismatch && (
                          <div className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            Differs from DMF
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">&mdash;</span>
                    )}
                  </TableCell>
                  {canMutate && (
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {r.alert !== 'NONE' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onConfirm(r)}
                            aria-label="Confirm still accurate"
                            title="Still accurate — restart the review window"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                          </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
                          <Pencil className="h-3.5 w-3.5 mr-1.5" />
                          Change availability
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
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        title={editing ? editing.name : ''}
        description={editing ? `Change availability · ${editing.departmentName}` : 'Change availability'}
        size="sm"
      >
        {editing && (
          <form action={onSubmit} className="space-y-3">
            <div>
              <Label htmlFor="availabilityStatus">Change availability</Label>
              <Select
                id="availabilityStatus"
                name="availabilityStatus"
                defaultValue={editing.availabilityStatus}
                className="w-full"
              >
                {AVAILABILITY_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="availabilityRemarks">Remarks</Label>
              <Textarea
                id="availabilityRemarks"
                name="availabilityRemarks"
                rows={3}
                placeholder="e.g. prefers 7PM to 2AM PH time"
                defaultValue={editing.availabilityRemarks ?? ''}
              />
            </div>

            <div>
              <Label htmlFor="availabilityChangedAt">Date changed</Label>
              <Input
                id="availabilityChangedAt"
                name="availabilityChangedAt"
                type="date"
                defaultValue={toDateInput(editing.availabilityChangedAt) || todayInput()}
              />
            </div>

            <div>
              <Label htmlFor="availabilityReviewDueAt">DMF update status due date</Label>
              <Input
                id="availabilityReviewDueAt"
                name="availabilityReviewDueAt"
                type="date"
                defaultValue={toDateInput(editing.availabilityReviewDueAt)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                When this record should next be re-checked. Left blank, it&apos;s {AVAILABILITY_REVIEW_DAYS} days
                after the date changed.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
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
