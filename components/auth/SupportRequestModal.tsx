'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitLoginSupportRequest } from '@/app/(auth)/login/actions'

type SupportRequestModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const ISSUE_OPTIONS = [
  "Can't remember which Google account to use",
  "Google says my account isn't registered",
  'My account appears disabled',
  "I'm getting a redirect or OAuth error",
  'Other issue',
]

const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground'

export function SupportRequestModal({ open, onOpenChange }: SupportRequestModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [selectedIssues, setSelectedIssues] = useState<string[]>([])
  const [details, setDetails] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const toggleIssue = (issue: string) => {
    setSelectedIssues((prev) => (prev.includes(issue) ? prev.filter((i) => i !== issue) : [...prev, issue]))
  }

  const reset = () => {
    setName('')
    setEmail('')
    setSelectedIssues([])
    setDetails('')
  }

  const handleSubmit = async () => {
    if (!email.trim() || !email.includes('@')) {
      toast.error('Enter the email we should reply to')
      return
    }
    if (selectedIssues.length === 0 && !details.trim()) {
      toast.error('Select an issue or add details')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('email', email)
      for (const issue of selectedIssues) fd.append('issues', issue)
      fd.set('details', details)
      fd.set('website', website)
      const res = await submitLoginSupportRequest(fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Sent. An admin will email you to sort it out.')
      onOpenChange(false)
      reset()
    } catch {
      toast.error("Couldn't send your request. Check your connection and try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next)
      }}
      title="Trouble logging in?"
      description="Let us know what's happening and an admin will follow up by email."
      size="md"
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" disabled={submitting} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" disabled={submitting} onClick={handleSubmit}>
            {submitting ? (
              <>
                <Loader2 className="animate-spin" />
                Sending...
              </>
            ) : (
              'Send'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="sr-name" className={LABEL}>
              Name
            </label>
            <Input
              id="sr-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              placeholder="Full name"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="sr-email" className={LABEL}>
              Email to reply to
            </label>
            <Input
              id="sr-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              placeholder="you@gmail.com"
            />
          </div>
        </div>
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
          aria-label="Details"
          placeholder="Add any details, e.g. the exact error message (optional)"
          className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />
      </div>
    </Modal>
  )
}
