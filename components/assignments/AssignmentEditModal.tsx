'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { format } from 'date-fns'
import { updateAssignment } from '@/app/(dashboard)/assignments/actions'

export type AssignmentEditData = {
  id: string
  clientName: string
  vaName: string
  type: 'REGULAR' | 'PROJECT'
  agreedHours: number
  monthlyHours: number | null
  startDate: string
  endDate: string | null
  notes: string | null
}

export function AssignmentEditModal({
  assignment,
  open,
  onClose,
}: {
  assignment: AssignmentEditData
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [type, setType] = useState<'REGULAR' | 'PROJECT'>(assignment.type)
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateAssignment(assignment.id, formData)
        toast.success('Assignment updated')
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update assignment')
      }
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Edit Assignment — ${assignment.clientName}`}
      description={`Assigned to ${assignment.vaName}`}
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="assignment-edit-form" size="sm" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id="assignment-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label>Assignment Type *</Label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setType('REGULAR')}>
              <Badge variant={type === 'REGULAR' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                Regular (Monthly retainer)
              </Badge>
            </button>
            <button type="button" onClick={() => setType('PROJECT')}>
              <Badge variant={type === 'PROJECT' ? 'default' : 'outline'} className="cursor-pointer px-3 py-1">
                Project (Fixed scope)
              </Badge>
            </button>
          </div>
          <input type="hidden" name="type" value={type} />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="agreedHours">Agreed Hours *</Label>
            <Input id="agreedHours" name="agreedHours" type="number" step="0.5" min="0" required defaultValue={assignment.agreedHours} className="h-9" />
          </div>
          {type === 'REGULAR' && (
            <div className="space-y-1.5">
              <Label htmlFor="monthlyHours">Monthly Hours</Label>
              <Input id="monthlyHours" name="monthlyHours" type="number" step="0.5" min="0" defaultValue={assignment.monthlyHours ?? ''} className="h-9" />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Start Date *</Label>
            <Input id="startDate" name="startDate" type="date" required defaultValue={format(new Date(assignment.startDate), 'yyyy-MM-dd')} className="h-9" />
          </div>
          {type === 'PROJECT' && (
            <div className="space-y-1.5">
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                required
                defaultValue={assignment.endDate ? format(new Date(assignment.endDate), 'yyyy-MM-dd') : ''}
                className="h-9"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={assignment.notes ?? ''} className="min-h-24 text-sm" />
        </div>
      </form>
    </Modal>
  )
}
