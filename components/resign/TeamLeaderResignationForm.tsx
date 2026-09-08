'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { MemberCombobox, type ComboboxOption } from '@/components/teams/MemberCombobox'
import { submitTeamLeaderResignation } from '@/app/resign/actions'

export function TeamLeaderResignationForm({
  vaOptions,
  assignmentsByVa,
}: {
  vaOptions: ComboboxOption[]
  assignmentsByVa: Record<string, { id: string; clientName: string }[]>
}) {
  const [vaProfileId, setVaProfileId] = useState('')
  const [assignmentId, setAssignmentId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState('')
  const [recordingLink, setRecordingLink] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const assignments = vaProfileId ? assignmentsByVa[vaProfileId] ?? [] : []
  const hasNoActiveClient = !!vaProfileId && assignments.length === 0
  const canSubmit = !!vaProfileId && !!assignmentId && !!effectiveDate && !!recordingLink.trim() && !!reason.trim()

  const handleVaSelect = (id: string) => {
    setVaProfileId(id)
    setAssignmentId('')
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!canSubmit) {
      setError('Fill in every field before submitting.')
      return
    }
    setSubmitting(true)
    setError(null)
    const fd = new FormData()
    fd.set('vaProfileId', vaProfileId)
    fd.set('assignmentId', assignmentId)
    fd.set('effectiveDate', effectiveDate)
    fd.set('recordingLink', recordingLink)
    fd.set('reason', reason)
    try {
      await submitTeamLeaderResignation(fd)
    } catch (err) {
      const digest = err && typeof err === 'object' && 'digest' in err ? String(err.digest) : ''
      if (digest.startsWith('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label className="text-xs font-medium mb-1 block">Who is resigning?</Label>
        <MemberCombobox
          options={vaOptions}
          value={vaProfileId}
          onSelect={handleVaSelect}
          disabled={submitting}
          placeholder="Search your team…"
        />
      </div>

      <div>
        <Label htmlFor="assignmentId" className="text-xs font-medium mb-1 block">Which client?</Label>
        <select
          id="assignmentId"
          value={assignmentId}
          onChange={(e) => setAssignmentId(e.target.value)}
          disabled={submitting || !vaProfileId || hasNoActiveClient}
          className="w-full h-9 text-sm rounded-md border bg-background px-2 disabled:opacity-50"
        >
          <option value="">{vaProfileId ? 'Select a client…' : 'Select a VA first'}</option>
          {assignments.map((a) => (
            <option key={a.id} value={a.id}>{a.clientName}</option>
          ))}
        </select>
        {hasNoActiveClient && (
          <p className="text-xs text-destructive mt-1">This VA has no active client assignment. Contact HR directly.</p>
        )}
      </div>

      <div>
        <Label htmlFor="effectiveDate" className="text-xs font-medium mb-1 block">Effective date (last working day)</Label>
        <Input id="effectiveDate" type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} disabled={submitting} />
      </div>

      <div>
        <Label htmlFor="recordingLink" className="text-xs font-medium mb-1 block">Resignation call recording link</Label>
        <Input
          id="recordingLink"
          type="url"
          value={recordingLink}
          onChange={(e) => setRecordingLink(e.target.value)}
          placeholder="https://…"
          disabled={submitting}
        />
      </div>

      <div>
        <Label htmlFor="reason" className="text-xs font-medium mb-1 block">Reason for resignation</Label>
        <Textarea
          id="reason"
          name="reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="When they told you, why, anything relevant."
          disabled={submitting}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !canSubmit}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...</> : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
