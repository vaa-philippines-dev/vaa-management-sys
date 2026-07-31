'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Plus, X, UserPlus, Copy, Check } from 'lucide-react'
import { quickAddVA, createVAOnboardingInvite } from '@/app/(dashboard)/vas/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function AddVAModal({
  open,
  onClose,
  departments = [],
  positionSkills = [],
}: {
  open: boolean
  onClose: () => void
  departments?: { id: string; name: string }[]
  positionSkills?: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()
  const [inviteLink, setInviteLink] = useState<{ url: string; name: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleClose = () => {
    setInviteLink(null)
    setCopied(false)
    onClose()
  }

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const name = ((data.name as string) ?? '').trim()
    const email = ((data.email as string) ?? '').trim().toLowerCase()

    if (!name) { toast.error('Full name is required'); setSubmitting(false); return }

    let userId: string
    try {
      const fd = new FormData()
      fd.set('name', name)
      fd.set('email', email)
      if (data.departmentId) fd.set('departmentId', data.departmentId as string)
      if (data.positionSkillId) fd.set('positionSkillId', data.positionSkillId as string)
      userId = (await quickAddVA(fd)).userId
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add VA')
      setSubmitting(false)
      return
    }

    // The VA now exists regardless of what happens below, so from here on
    // we always toast success, reset the form, and refresh the roster —
    // an invite-link failure only downgrades to a warning, not a hard error.
    toast.success(`${name} added`)
    form.reset()
    startTransition(() => router.refresh())

    try {
      const { token } = await createVAOnboardingInvite(userId)
      setInviteLink({ url: `${window.location.origin}/onboard/${token}`, name })
    } catch (e: any) {
      toast.warning(e.message ?? `${name} was added, but generating the onboarding link failed. Ask an admin to check the logs.`)
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={handleClose}>
      <div
        className="bg-card border rounded-lg shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">{inviteLink ? 'Onboarding Link Ready' : 'Add VA to Roster'}</h3>
          </div>
          <button type="button" onClick={handleClose} className="p-1 hover:bg-accent rounded">
            <X className="h-4 w-4" />
          </button>
        </div>

        {inviteLink ? (
          <div className="p-4 space-y-3">
            <p className="text-xs text-muted-foreground">
              {inviteLink.name} was added. Send this link to them (WhatsApp, email, etc.) so they can fill in the
              rest of their profile — it expires in 7 days.
            </p>
            <div className="flex items-center gap-2">
              <Input readOnly value={inviteLink.url} className="h-9 text-xs font-mono" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" size="sm" className="h-9 shrink-0" onClick={handleCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" className="h-8" onClick={handleClose}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 space-y-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Full Name</Label>
              <Input name="name" required placeholder="Juan Dela Cruz" className="h-9 text-sm" />
              <p className="text-[10px] text-muted-foreground mt-1">
                Optional email will be auto-generated if blank
              </p>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Email</Label>
              <Input name="email" type="email" placeholder="juan@vaa.com" className="h-9 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Department</Label>
                <select name="departmentId" className="w-full h-9 text-sm rounded-md border bg-background px-2">
                  <option value="">— None —</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Position</Label>
                <select name="positionSkillId" className="w-full h-9 text-sm rounded-md border bg-background px-2">
                  <option value="">— None —</option>
                  {positionSkills.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleClose}>Cancel</Button>
              <Button type="submit" size="sm" className="h-8" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Adding...</>
                ) : (
                  <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
