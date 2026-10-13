'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ExternalLink, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { MEETING_DECISION_LABELS } from '@/lib/offboarding'
import { saveOffboardingMeeting } from '@/app/(dashboard)/offboarding/actions'

export type OffboardingMeeting = {
  date: string | null
  attendees: string | null
  recordingUrl: string | null
  notes: string | null
  decision: string | null
}

// The end-of-contract meeting: what was discussed with the client/VA and what
// was decided, kept on the case so the end can be verified later.
export function OffboardingMeetingCard({
  terminationId,
  meeting,
  canEdit,
}: {
  terminationId: string
  meeting: OffboardingMeeting
  canEdit: boolean
}) {
  const router = useRouter()
  const empty = !meeting.date && !meeting.attendees && !meeting.recordingUrl && !meeting.notes && !meeting.decision
  const [editing, setEditing] = useState(false)
  const [isPending, startTransition] = useTransition()

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await saveOffboardingMeeting(terminationId, formData)
      if (res?.error) {
        toast.error(res.error)
        return
      }
      toast.success('Meeting details saved')
      setEditing(false)
      router.refresh()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="text-base">End of Contract Meeting</CardTitle>
        {canEdit && !editing && (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="h-3.5 w-3.5 mr-1.5" />
            {empty ? 'Add details' : 'Edit'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {editing ? (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="meetingDate">Meeting date</Label>
                <Input
                  id="meetingDate"
                  name="meetingDate"
                  type="date"
                  defaultValue={meeting.date ? meeting.date.slice(0, 10) : ''}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meetingDecision">Decision</Label>
                <Select id="meetingDecision" name="meetingDecision" defaultValue={meeting.decision ?? ''} className="w-full">
                  <option value="">— Not decided —</option>
                  {Object.entries(MEETING_DECISION_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingAttendees">Who attended</Label>
              <Input
                id="meetingAttendees"
                name="meetingAttendees"
                defaultValue={meeting.attendees ?? ''}
                placeholder="e.g. Client, CS, Team Leader, VA"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingRecordingUrl">Recording link</Label>
              <Input
                id="meetingRecordingUrl"
                name="meetingRecordingUrl"
                type="url"
                defaultValue={meeting.recordingUrl ?? ''}
                placeholder="https://"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="meetingNotes">What was discussed</Label>
              <Textarea id="meetingNotes" name="meetingNotes" defaultValue={meeting.notes ?? ''} className="min-h-24 text-sm" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </form>
        ) : empty ? (
          <p className="text-muted-foreground">No meeting recorded yet.</p>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground mb-1">Meeting date</dt>
              <dd className="font-medium">{meeting.date ? format(new Date(meeting.date), 'MMM dd, yyyy') : '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground mb-1">Decision</dt>
              <dd>
                {meeting.decision ? (
                  <Badge variant="outline">{MEETING_DECISION_LABELS[meeting.decision] ?? meeting.decision}</Badge>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-xs text-muted-foreground mb-1">Who attended</dt>
              <dd className="font-medium">{meeting.attendees ?? '—'}</dd>
            </div>
            {meeting.recordingUrl && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground mb-1">Recording</dt>
                <dd>
                  <a
                    href={meeting.recordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline break-all"
                  >
                    Open recording
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </dd>
              </div>
            )}
            {meeting.notes && (
              <div className="sm:col-span-2">
                <dt className="text-xs text-muted-foreground mb-1">What was discussed</dt>
                <dd className="whitespace-pre-wrap">{meeting.notes}</dd>
              </div>
            )}
          </dl>
        )}
      </CardContent>
    </Card>
  )
}
