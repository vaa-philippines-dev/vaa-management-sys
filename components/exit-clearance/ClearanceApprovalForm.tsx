'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Check } from 'lucide-react'
import { actOnClearanceApprovalPublic } from '@/app/exit-clearance/[token]/actions'

export function ClearanceApprovalForm({
  token,
  checklistItems,
}: {
  token: string
  checklistItems: { label: string; checked: boolean }[]
}) {
  const router = useRouter()
  const [approverName, setApproverName] = useState('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState<'APPROVED' | 'REJECTED' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async (status: 'APPROVED' | 'REJECTED') => {
    setError(null)
    if (!approverName.trim()) {
      setError('Your name is required.')
      return
    }
    if (status === 'REJECTED' && !comments.trim()) {
      setError('A comment describing the outstanding requirement is required when rejecting.')
      return
    }
    setSubmitting(status)
    try {
      const fd = new FormData()
      fd.set('approverName', approverName)
      fd.set('status', status)
      fd.set('comments', comments)
      await actOnClearanceApprovalPublic(token, fd)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(null)
    }
  }

  return (
    <div className="space-y-4 pt-2 border-t">
      {checklistItems.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Please verify</p>
          <ul className="space-y-1.5">
            {checklistItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Label htmlFor="approverName" className="text-xs font-medium mb-1 block">Your Name</Label>
        <Input
          id="approverName"
          value={approverName}
          onChange={(e) => setApproverName(e.target.value)}
          placeholder="Juan Dela Cruz"
          disabled={!!submitting}
        />
      </div>

      <div>
        <Label htmlFor="comments" className="text-xs font-medium mb-1 block">Comments {submitting !== 'APPROVED' && '(required if rejecting)'}</Label>
        <Textarea
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Any outstanding requirement or note"
          disabled={!!submitting}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={() => submit('REJECTED')} disabled={!!submitting}>
          {submitting === 'REJECTED' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Reject'}
        </Button>
        <Button onClick={() => submit('APPROVED')} disabled={!!submitting}>
          {submitting === 'APPROVED' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
        </Button>
      </div>
    </div>
  )
}
