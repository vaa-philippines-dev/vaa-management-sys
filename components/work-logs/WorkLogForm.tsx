'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { createWorkLog } from '@/app/(dashboard)/work-logs/actions'

export function WorkLogForm({
  assignments,
  defaultAssignmentId,
}: {
  assignments: { id: string; label: string }[]
  defaultAssignmentId?: string
}) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={createWorkLog} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="assignmentId">Assignment *</Label>
            <select
              id="assignmentId"
              name="assignmentId"
              defaultValue={defaultAssignmentId ?? ''}
              required
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select assignment</option>
              {assignments.map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="workDate">Work Date *</Label>
              <Input id="workDate" name="workDate" type="date" defaultValue={today} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="hours">Hours *</Label>
              <Input id="hours" name="hours" type="number" step="0.25" min="0" max="24" required />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" placeholder="What was done?" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="submit">Log Hours</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}