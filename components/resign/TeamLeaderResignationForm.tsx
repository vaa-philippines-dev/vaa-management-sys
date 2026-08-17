'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { MemberCombobox, type ComboboxOption } from '@/components/teams/MemberCombobox'
import { submitTeamLeaderResignation } from '@/app/resign/actions'

export function TeamLeaderResignationForm({ vaOptions }: { vaOptions: ComboboxOption[] }) {
  const [vaProfileId, setVaProfileId] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!vaProfileId) {
      setError('Select which VA is resigning.')
      return
    }
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('vaProfileId', vaProfileId)
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
          onSelect={setVaProfileId}
          disabled={submitting}
          placeholder="Search your team…"
        />
      </div>

      <div>
        <Label htmlFor="reason" className="text-xs font-medium mb-1 block">What do you know so far? (optional)</Label>
        <Textarea id="reason" name="reason" rows={3} placeholder="When they told you, why, anything relevant." />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting || !vaProfileId}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...</> : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
