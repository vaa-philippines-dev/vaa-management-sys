'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
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
import { cn } from '@/lib/utils'
import { AlertTriangle, CheckCircle2, Pencil, Info } from 'lucide-react'
import { ALERT_LABELS, type AvailabilityRow } from '@/lib/va-availability-fields'
import { LEAVE_TYPE_LABELS, TMF_CHECKIN_LOOKAHEAD_DAYS, TMF_LEAVE_LOOKAHEAD_DAYS, type TmfData } from '@/lib/tmf-fields'
import { updateTmfAvailability, confirmTmfAvailability } from '@/app/(dashboard)/tmf/actions'

const AVAILABILITY_STATUSES = ['AVAILABLE', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE'] as const

const STATUS_LABELS: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially Assigned',
  FULLY_ASSIGNED: 'Full',
  ON_LEAVE: 'On Leave',
  UNAVAILABLE: 'Unavailable',
}

type Tab = 'availability' | 'checkins' | 'engagements' | 'leave'

function formatDate(iso: string | null) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: '2-digit', timeZone: 'UTC' }).format(d)
}

function hours(n: number | null) {
  if (n == null) return '—'
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`
}

const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : '')
const todayInput = () => new Date().toISOString().slice(0, 10)

export function TmfBoard({ data }: { data: TmfData }) {
  const router = useRouter()
  const { team } = data
  const [tab, setTab] = useState<Tab>('availability')
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<AvailabilityRow | null>(null)
  const [saving, setSaving] = useState(false)

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'availability', label: 'Availability', count: data.availability.length },
    { key: 'checkins', label: 'Client check-ins', count: data.checkIns.length },
    { key: 'engagements', label: 'Engagements', count: data.engagements.length },
    { key: 'leave', label: 'Leave', count: data.leave.length },
  ]

  const q = search.trim().toLowerCase()
  const match = (...fields: (string | null)[]) => !q || fields.some((f) => (f ?? '').toLowerCase().includes(q))

  const availability = useMemo(
    () => data.availability.filter((r) => match(r.name, r.employeeId, r.position)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `match` only closes over `q`
    [data.availability, q]
  )

  const onConfirm = async (row: AvailabilityRow) => {
    try {
      await confirmTmfAvailability(team.id, row.vaProfileId)
      toast.success(`${row.name}'s TMF record re-confirmed`)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not confirm')
    }
  }

  const onSubmit = async (formData: FormData) => {
    if (!editing) return
    setSaving(true)
    try {
      await updateTmfAvailability(team.id, editing.vaProfileId, formData)
      toast.success('TMF updated')
      setEditing(null)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update TMF')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border bg-muted/30 p-0.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                tab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t.label}
              <span className="ml-1.5 text-muted-foreground">{t.count}</span>
            </button>
          ))}
        </div>
        <Input
          placeholder="Search team members..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs ml-auto"
        />
      </div>

      {tab === 'availability' && (
        <>
          <div className="flex items-start gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {team.canEdit ? (
                <>
                  The <span className="font-medium text-foreground">TMF</span>{' '}columns are yours to keep current — your
                  own read on each member&apos;s availability. The DMF column is the department manager&apos;s and is
                  shown read-only so you can spot where the two disagree.
                </>
              ) : (
                <>You&apos;re viewing this team&apos;s TMF read-only. Only its Team Leader updates the TMF columns.</>
              )}{' '}
              Hours and clients count {team.departmentName} work only.
            </span>
          </div>
          {availability.length === 0 ? (
            <EmptyCard text={data.availability.length === 0 ? 'No team members yet.' : 'No members match.'} />
          ) : (
            <Card className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>VA</TableHead>
                    <TableHead className="text-right">Preferred</TableHead>
                    <TableHead className="text-right">Booked</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Clients</TableHead>
                    <TableHead>DMF status</TableHead>
                    <TableHead>TMF status</TableHead>
                    <TableHead>TMF remarks</TableHead>
                    <TableHead>TMF updated</TableHead>
                    {team.canEdit && <TableHead className="w-32"></TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {availability.map((r) => (
                    <TableRow key={r.rowKey}>
                      <TableCell className="max-w-xs">
                        <Link href={`/vas/${r.vaProfileId}`} className="font-medium hover:text-primary">
                          {r.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">
                          {[r.employeeId, r.position].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{hours(r.preferredHours)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {hours(r.currentHours)}
                        {r.otherDepartmentHours > 0 && (
                          <div className="text-[11px] text-muted-foreground/70" title="Booked in other departments">
                            +{hours(r.otherDepartmentHours)} elsewhere
                          </div>
                        )}
                      </TableCell>
                      <TableCell
                        className={cn('text-right font-semibold', r.availableHours > 0 ? 'text-success' : 'text-muted-foreground')}
                      >
                        {hours(r.availableHours)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">{r.clientCount}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground">
                          {STATUS_LABELS[r.availabilityStatus] ?? r.availabilityStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.tmfAvailabilityStatus ? (
                          <div className="space-y-0.5">
                            <Badge variant={r.tmfMismatch ? 'destructive' : 'secondary'}>
                              {STATUS_LABELS[r.tmfAvailabilityStatus] ?? r.tmfAvailabilityStatus}
                            </Badge>
                            {r.tmfMismatch && <div className="text-[11px] text-warning">Differs from DMF</div>}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Not set</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[14rem]">
                        <div className="text-xs text-muted-foreground truncate" title={r.tmfRemarks ?? undefined}>
                          {r.tmfRemarks ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{formatDate(r.tmfChangedAt)}</div>
                        {r.tmfUpdatedByName && <div className="text-muted-foreground">by {r.tmfUpdatedByName}</div>}
                        {r.tmfAlert !== 'NONE' && (
                          <div className="flex items-center gap-1 text-warning">
                            <AlertTriangle className="h-3 w-3" />
                            {ALERT_LABELS[r.tmfAlert]}
                          </div>
                        )}
                      </TableCell>
                      {team.canEdit && (
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            {r.tmfAlert !== 'NONE' && r.tmfChangedAt && (
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
                              Update
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
        </>
      )}

      {tab === 'checkins' && (
        <>
          <p className="text-xs text-muted-foreground">
            Open client check-ins (Performance Monitoring milestones) that are overdue or due in the next{' '}
            {TMF_CHECKIN_LOOKAHEAD_DAYS} days, for this team&apos;s {team.departmentName} engagements.
          </p>
          {data.checkIns.filter((c) => match(c.vaName, c.clientName)).length === 0 ? (
            <EmptyCard text="No check-ins due." />
          ) : (
            <Card className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>VA</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Due</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.checkIns
                    .filter((c) => match(c.vaName, c.clientName))
                    .map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.vaName}</TableCell>
                        <TableCell className="text-muted-foreground">{c.clientName}</TableCell>
                        <TableCell>{c.milestone}</TableCell>
                        <TableCell>
                          <span className={cn('text-xs', c.overdue && 'font-medium text-destructive')}>
                            {formatDate(c.dueDate)}
                            {c.overdue && ' · overdue'}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {tab === 'engagements' && (
        <>
          {data.engagements.filter((e) => match(e.vaName, e.clientName)).length === 0 ? (
            <EmptyCard text="No active engagements." />
          ) : (
            <Card className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>VA</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Hours</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Check-ins done</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.engagements
                    .filter((e) => match(e.vaName, e.clientName))
                    .map((e) => (
                      <TableRow key={e.assignmentId}>
                        <TableCell className="font-medium">{e.vaName}</TableCell>
                        <TableCell className="text-muted-foreground">{e.clientName}</TableCell>
                        <TableCell className="text-right">{hours(e.hours)}</TableCell>
                        <TableCell className="text-xs">{formatDate(e.startDate)}</TableCell>
                        <TableCell className="text-xs">
                          {e.checksTotal === 0 ? '—' : `${e.checksDone} / ${e.checksTotal}`}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      {tab === 'leave' && (
        <>
          <p className="text-xs text-muted-foreground">
            Approved and pending leave for team members, today through the next {TMF_LEAVE_LOOKAHEAD_DAYS} days.
          </p>
          {data.leave.filter((l) => match(l.vaName)).length === 0 ? (
            <EmptyCard text="Nobody on leave." />
          ) : (
            <Card className="overflow-x-auto">
              <Table className="text-sm">
                <TableHeader>
                  <TableRow>
                    <TableHead>VA</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.leave
                    .filter((l) => match(l.vaName))
                    .map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-medium">
                          {l.vaName}
                          {l.onLeaveToday && <Badge className="ml-2" variant="secondary">Out today</Badge>}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{LEAVE_TYPE_LABELS[l.leaveType] ?? l.leaveType}</TableCell>
                        <TableCell className="text-xs">
                          {formatDate(l.startDate)} – {formatDate(l.endDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={l.status === 'APPROVED' ? 'secondary' : 'outline'}>
                            {l.status === 'APPROVED' ? 'Approved' : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <Modal
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null)
        }}
        title={editing ? editing.name : ''}
        description={`Update TMF · ${team.name}`}
        size="sm"
      >
        {editing && (
          <form action={onSubmit} className="space-y-3">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              DMF says <span className="font-medium text-foreground">{STATUS_LABELS[editing.availabilityStatus]}</span>
              {editing.availabilityRemarks && <> — &ldquo;{editing.availabilityRemarks}&rdquo;</>}
            </div>
            <div>
              <Label htmlFor="tmfAvailabilityStatus">TMF change availability</Label>
              <Select
                id="tmfAvailabilityStatus"
                name="tmfAvailabilityStatus"
                defaultValue={editing.tmfAvailabilityStatus ?? editing.availabilityStatus}
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
              <Label htmlFor="tmfRemarks">TMF remarks</Label>
              <Textarea
                id="tmfRemarks"
                name="tmfRemarks"
                rows={3}
                placeholder="e.g. can take 2 more hours from next week"
                defaultValue={editing.tmfRemarks ?? ''}
              />
            </div>
            <div>
              <Label htmlFor="tmfChangedAt">TMF date changed</Label>
              <Input
                id="tmfChangedAt"
                name="tmfChangedAt"
                type="date"
                defaultValue={toDateInput(editing.tmfChangedAt) || todayInput()}
              />
              <p className="text-xs text-muted-foreground mt-1">Review comes due 30 days from this date.</p>
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

function EmptyCard({ text }: { text: string }) {
  return (
    <Card className="flex items-center justify-center py-12 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
    </Card>
  )
}
