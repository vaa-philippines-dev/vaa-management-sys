'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CalendarCog } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { KPI_MILESTONES, KPI_MILESTONE_LABELS, DEFAULT_KPI_MILESTONES } from '@/lib/kpi-checks-labels'
import { updateKpiSchedule } from '@/app/(dashboard)/performance/actions'
import type { KpiMilestone } from '@/src/generated/prisma/enums'

export type KpiScheduleDepartment = {
  id: string
  name: string
  // Already resolved — the default seven when never customised.
  milestones: KpiMilestone[]
}

// FB-0015: which KPI check-in milestones each department runs.
export function KpiScheduleButton({ departments }: { departments: KpiScheduleDepartment[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? '')
  const [selected, setSelected] = useState<KpiMilestone[]>(departments[0]?.milestones ?? DEFAULT_KPI_MILESTONES)
  const [isPending, startTransition] = useTransition()

  if (departments.length === 0) return null

  const pickDepartment = (id: string) => {
    setDepartmentId(id)
    setSelected(departments.find((d) => d.id === id)?.milestones ?? DEFAULT_KPI_MILESTONES)
  }

  const toggle = (m: KpiMilestone) =>
    setSelected((prev) => (prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m]))

  const save = () => {
    startTransition(async () => {
      try {
        const res = await updateKpiSchedule(departmentId, selected)
        if (res?.error) {
          toast.error(res.error)
          return
        }
        const changes = [
          res.createdChecks ? `${res.createdChecks} check-in${res.createdChecks === 1 ? '' : 's'} added` : null,
          res.removedChecks ? `${res.removedChecks} removed` : null,
        ].filter(Boolean)
        toast.success(`Check-in schedule saved${changes.length ? ` — ${changes.join(', ')}` : ''}`)
        setOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save the schedule')
      }
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <CalendarCog className="h-3.5 w-3.5 mr-1.5" />
        Check-in schedule
      </Button>
      {open && (
        <Modal
          open={open}
          onOpenChange={(o) => !o && setOpen(false)}
          title="KPI Check-in Schedule"
          description="Which KPI calls this department runs for each engagement."
          size="md"
          footer={
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={save} disabled={isPending || selected.length === 0}>
                {isPending ? 'Saving…' : 'Save Schedule'}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            {departments.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="kpi-schedule-dept">Department</Label>
                <Select
                  id="kpi-schedule-dept"
                  value={departmentId}
                  onChange={(e) => pickDepartment(e.target.value)}
                  className="w-full"
                >
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {KPI_MILESTONES.map((m) => (
                <label
                  key={m}
                  className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer hover:bg-muted/40"
                >
                  <input type="checkbox" checked={selected.includes(m)} onChange={() => toggle(m)} />
                  <span className="font-medium">{KPI_MILESTONE_LABELS[m]}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{m}</span>
                </label>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              New engagements get this schedule. Running engagements gain the added check-ins that are still ahead
              of them and lose removed ones that haven&apos;t come up yet — past and noted check-ins are kept.
            </p>
          </div>
        </Modal>
      )}
    </>
  )
}
