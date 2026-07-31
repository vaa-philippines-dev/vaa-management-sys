'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, Link2, Copy, Check } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { createVAOnboardingInvite } from '@/app/(dashboard)/vas/actions'

type InviteStatus = 'never' | 'pending' | 'expired' | 'completed'

export function OnboardingInviteControl({
  userId,
  status,
  expiresAt,
}: {
  userId: string
  status: InviteStatus
  expiresAt: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setSubmitting(true)
    try {
      const { token } = await createVAOnboardingInvite(userId)
      setLink(`${window.location.origin}/onboard/${token}`)
      setOpen(true)
      router.refresh()
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to generate onboarding link')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!link) return
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClose = () => {
    setOpen(false)
    setLink(null)
    setCopied(false)
  }

  const statusBadge = {
    never: null,
    pending: <Badge variant="outline" className="text-[10px] bg-info/10 text-info border-info/20">Onboarding link sent{expiresAt ? ` — expires ${format(new Date(expiresAt), 'MMM dd')}` : ''}</Badge>,
    expired: <Badge variant="outline" className="text-[10px] bg-warning/15 text-warning border-warning/20">Onboarding link expired</Badge>,
    completed: <Badge variant="outline" className="text-[10px] bg-success/15 text-success border-success/20">Onboarding completed</Badge>,
  }[status]

  const buttonLabel = status === 'never' ? 'Send Onboarding Link' : 'Resend Onboarding Link'

  return (
    <>
      <div className="flex items-center gap-2">
        {statusBadge}
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleGenerate} disabled={submitting}>
          {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5 mr-1.5" />}
          {buttonLabel}
        </Button>
      </div>

      <Modal open={open} onOpenChange={handleClose} title="Onboarding Link Ready" size="sm">
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Send this link to the VA (WhatsApp, email, etc.) so they can fill in the rest of their profile —
            it expires in 7 days. Generating a new link invalidates any previous one and resets their progress
            if they hadn&rsquo;t finished yet.
          </p>
          <div className="flex items-center gap-2">
            <Input readOnly value={link ?? ''} className="h-9 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" size="sm" className="h-9 shrink-0" onClick={handleCopy}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <div className="flex justify-end pt-1">
            <Button type="button" size="sm" className="h-8" onClick={handleClose}>Done</Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
