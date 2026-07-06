'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type SupportRequestModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ISSUE_OPTIONS = [
  "Can't remember which Google account to use",
  "Google says my account isn't registered",
  "My account appears disabled",
  "I'm getting a redirect or OAuth error",
  "Other issue",
]

export function SupportRequestModal({ open, onOpenChange }: SupportRequestModalProps) {
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) =>
      prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]
    )
  }

  const reset = () => {
    setSelectedIssues([])
    setDetails('')
    setProgress(0)
  }

  const handleSubmit = async () => {
    if (selectedIssues.length === 0 && !details.trim()) {
      toast.error('Select an issue or add details')
      return
    }

    setSubmitting(true)
    setProgress(0)

    // TODO(backend): replace this simulated timer with a real submission,
    // e.g. await submitSupportRequest({ issues: selectedIssues, details })
    // once a server action / ticketing or email integration exists.
    for (const pct of [25, 55, 80, 100]) {
      await new Promise((r) => setTimeout(r, 250))
      setProgress(pct)
    }

    toast.success('Request submitted — our team will reach out shortly.')
    setSubmitting(false)
    onOpenChange(false)
    reset()
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
      title="Trouble logging in?"
      description="Let us know what's happening and we'll follow up."
      size="md"
      footer={
        <div className="flex w-full flex-col gap-3">
          {submitting && <Progress value={progress} />}
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={submitting} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={submitting} onClick={handleSubmit}>
              {submitting ? (
                <>
                  <Loader2 className="animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit'
              )}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="space-y-2">
          {ISSUE_OPTIONS.map((issue) => (
            <label key={issue} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={selectedIssues.includes(issue)}
                onChange={() => toggleIssue(issue)}
                disabled={submitting}
                className="rounded"
              />
              <span>{issue}</span>
            </label>
          ))}
        </div>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          disabled={submitting}
          rows={3}
          placeholder="Add any additional details (optional)"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
      </div>
    </Modal>
  )
}
