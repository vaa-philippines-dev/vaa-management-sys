'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { submitAccountRequest } from '@/app/(auth)/login/actions'

type RequestAccountModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Real department names from the login page (server-side), so the request
  // names a department an admin can actually add them to.
  departments: string[]
}

type UserType = 'STAFF' | 'VA'

const LABEL = 'text-[10px] font-medium uppercase tracking-wider text-muted-foreground'

export function RequestAccountModal({ open, onOpenChange, departments }: RequestAccountModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [userType, setUserType] = useState<UserType>('STAFF')
  const [note, setNote] = useState('')
  const [website, setWebsite] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setEmail('')
    setDepartment('')
    setUserType('STAFF')
    setNote('')
  }

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      toast.error('Enter your name and a valid email')
      return
    }

    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('email', email)
      fd.set('department', department)
      fd.set('userType', userType)
      fd.set('note', note)
      fd.set('website', website)
      const res = await submitAccountRequest(fd)
      if ('error' in res) {
        toast.error(res.error)
        return
      }
      toast.success('Request sent. An admin will set up your account and email you.')
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
      title="Request an account"
      description="Tell us a bit about yourself and an admin will set you up."
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
              'Send request'
            )}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label htmlFor="ra-name" className={LABEL}>
            Full name
          </label>
          <Input
            id="ra-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ra-email" className={LABEL}>
            Google email you&apos;ll sign in with
          </label>
          <Input
            id="ra-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            placeholder="you@gmail.com"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="ra-department" className={LABEL}>
            Department
          </label>
          <select
            id="ra-department"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">I&apos;m not sure</option>
            {departments.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <span className={LABEL}>I am a</span>
          <div className="flex rounded-lg border p-1 text-xs">
            {(
              [
                ['STAFF', 'Internal Staff'],
                ['VA', 'Virtual Assistant'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                disabled={submitting}
                onClick={() => setUserType(value)}
                className={cn(
                  'flex-1 rounded-md py-1.5 transition-colors disabled:opacity-50',
                  userType === value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1">
          <label htmlFor="ra-note" className={LABEL}>
            Anything else? (optional)
          </label>
          <textarea
            id="ra-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            rows={2}
            placeholder="Your role or team, who your manager is…"
            className="w-full rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          />
        </div>
        {/* Honeypot: hidden from people, filled in by form-spamming bots. */}
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
