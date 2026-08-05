'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { submitExitSurvey } from '@/app/exit-survey/[token]/actions'

const REASON_OPTIONS = [
  'Better opportunity elsewhere',
  'Compensation',
  'Work schedule / hours',
  'Client relationship',
  'Career growth',
  'Personal / health reasons',
  'End of contract',
  'Other',
]

export function ExitSurveyForm({ token }: { token: string }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      await submitExitSurvey(token, fd)
    } catch (err: any) {
      if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <Label htmlFor="reasonForLeaving" className="text-xs font-medium mb-1 block">Reason for Leaving</Label>
        <select id="reasonForLeaving" name="reasonForLeaving" className="w-full h-9 text-sm rounded-md border bg-background px-2" defaultValue="">
          <option value="" disabled>Select a reason</option>
          {REASON_OPTIONS.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="feedback" className="text-xs font-medium mb-1 block">What could VAA Philippines have done better?</Label>
        <Textarea id="feedback" name="feedback" rows={4} placeholder="Your honest feedback helps us improve." />
      </div>

      <div>
        <Label className="text-xs font-medium mb-2 block">Would you recommend VAA Philippines as an employer?</Label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="wouldRecommend" value="yes" className="accent-primary" /> Yes
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="wouldRecommend" value="no" className="accent-primary" /> No
          </label>
        </div>
      </div>

      <div>
        <Label htmlFor="additionalComments" className="text-xs font-medium mb-1 block">Additional Comments (optional)</Label>
        <Textarea id="additionalComments" name="additionalComments" rows={3} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...</> : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
