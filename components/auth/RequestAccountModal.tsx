'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'

type RequestAccountModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// TODO(backend): fetch from Prisma Department table via a server action
// once this form is wired to the backend; for now this is a static placeholder list.
const DEPARTMENT_OPTIONS = [
  'Client Services',
  'Human Resources',
  'Finance & Accounting',
  'Marketing',
  'Operations',
  'IT & Systems',
  'Sales',
  'Executive Office',
]

type UserType = 'STAFF' | 'VA'

export function RequestAccountModal({ open, onOpenChange }: RequestAccountModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [userType, setUserType] = useState<UserType>('STAFF')
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)

  const reset = () => {
    setName('')
    setEmail('')
    setDepartment('')
    setUserType('STAFF')
    setProgress(0)
  }

  const handleSubmit = async () => {
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      toast.error('Enter your name and a valid email')
      return
    }

    setSubmitting(true)
    setProgress(0)

    // TODO(backend): replace this simulated timer with a real submission,
    // e.g. await requestAccount({ name, email, department, userType })
    // once a server action / ticketing or email integration exists.
    for (const pct of [25, 55, 80, 100]) {
      await new Promise((r) => setTimeout(r, 250))
      setProgress(pct)
    }

    toast.success('Request submitted — an admin will review it shortly.')
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
      title="Request an account"
      description="Tell us a bit about yourself and an admin will set you up."
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
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Full name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="Full name"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            placeholder="Work or personal email"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Department
          </label>
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            <option value="">Select a department</option>
            {DEPARTMENT_OPTIONS.map((dept) => (
              <option key={dept} value={dept}>
                {dept}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            I am a
          </label>
          <div className="flex rounded-lg border p-1 text-xs">
            <button
              type="button"
              disabled={submitting}
              onClick={() => setUserType('STAFF')}
              className={cn(
                'flex-1 rounded-md py-1.5 transition-colors disabled:opacity-50',
                userType === 'STAFF'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Internal Staff
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => setUserType('VA')}
              className={cn(
                'flex-1 rounded-md py-1.5 transition-colors disabled:opacity-50',
                userType === 'VA'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Virtual Assistant
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
