'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { submitResignationIntake } from '@/app/resign/actions'

export function ResignationIntakeForm({ departments }: { departments: { id: string; name: string }[] }) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      await submitResignationIntake(fd)
    } catch (err) {
      const digest = err && typeof err === 'object' && 'digest' in err ? String(err.digest) : ''
      if (digest.startsWith('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="teamLeaderName" className="text-xs font-medium mb-1 block">Your Name</Label>
          <Input id="teamLeaderName" name="teamLeaderName" required placeholder="Juan Dela Cruz" />
        </div>
        <div>
          <Label htmlFor="teamLeaderEmail" className="text-xs font-medium mb-1 block">Your Email</Label>
          <Input id="teamLeaderEmail" name="teamLeaderEmail" type="email" required placeholder="you@vaaphilippines.com" />
        </div>
      </div>

      <div>
        <Label htmlFor="vaIdentifier" className="text-xs font-medium mb-1 block">VA Name or Employee ID</Label>
        <Input id="vaIdentifier" name="vaIdentifier" required placeholder="e.g. Juan Cruz or VA-26-0001" />
      </div>

      <div>
        <Label htmlFor="departmentId" className="text-xs font-medium mb-1 block">Department</Label>
        <select
          id="departmentId"
          name="departmentId"
          required
          className="w-full h-9 text-sm rounded-md border bg-background px-2"
          defaultValue=""
        >
          <option value="" disabled>Select a department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="reason" className="text-xs font-medium mb-1 block">What do you know so far? (optional)</Label>
        <Textarea id="reason" name="reason" rows={3} placeholder="Anything you already know about why they're resigning, when they told you, etc." />
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
