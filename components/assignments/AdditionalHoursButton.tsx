'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { addAdditionalHours } from '@/app/(dashboard)/assignments/actions'

export function AdditionalHoursButton({
  assignmentId,
  clientName,
  vaName,
  type,
  currentHours,
}: {
  assignmentId: string
  clientName: string
  vaName: string
  type: 'REGULAR' | 'PROJECT'
  // The engagement's hours today, base + active add-ons — shown so the
  // manager can sanity-check the new total before saving.
  currentHours: number
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [hours, setHours] = useState('')
  const [isPending, startTransition] = useTransition()

  const added = Number(hours)
  const newTotal = Number.isFinite(added) && added > 0 ? currentHours + added : null

  const close = () => {
    setOpen(false)
    setHours('')
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await addAdditionalHours(assignmentId, formData)
        toast.success(`Added ${added}h for ${clientName}`)
        close()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add hours')
      }
    })
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />
        Add Hours
      </Button>
      {open && (
        <Modal
          open={open}
          onOpenChange={(o) => !o && close()}
          title={`Additional Hours — ${clientName}`}
          description={`Client request for more hours from ${vaName}. Tracked as its own engagement with its own KPI check-ins, like the DMF's "Additional" rows.`}
          size="md"
          footer={
            <>
              <Button type="button" variant="outline" size="sm" onClick={close} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" form="additional-hours-form" size="sm" disabled={isPending}>
                {isPending ? 'Saving…' : 'Add Hours'}
              </Button>
            </>
          }
        >
          <form id="additional-hours-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="hours">Additional Hours *</Label>
                <Input
                  id="hours"
                  name="hours"
                  type="number"
                  step="0.5"
                  min="0.5"
                  required
                  autoFocus
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="h-9"
                />
              </div>
              {type === 'REGULAR' && (
                <div className="space-y-1.5">
                  <Label htmlFor="monthlyHours">Monthly Hours</Label>
                  <Input id="monthlyHours" name="monthlyHours" type="number" step="0.5" min="0" className="h-9" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="startDate">Effective Date *</Label>
                <Input
                  id="startDate"
                  name="startDate"
                  type="date"
                  required
                  defaultValue={format(new Date(), 'yyyy-MM-dd')}
                  className="h-9"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Currently {currentHours}h
              {newTotal !== null && (
                <>
                  {' '}→ <span className="font-medium text-foreground">{newTotal}h</span> with this request
                </>
              )}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="notes">Request Details</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="e.g. Client asked for 2 more hours for inventory work — CSD ticket / email ref"
                className="min-h-20 text-sm"
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  )
}
