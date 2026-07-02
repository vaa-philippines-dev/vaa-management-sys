'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronDown, ChevronUp, Loader2, UserPlus } from 'lucide-react'
import { createUser } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function AddVAForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const name = ((data.name as string) ?? '').trim()
    const email = ((data.email as string) ?? '').trim().toLowerCase()

    if (!name) { toast.error('Full name is required'); setSubmitting(false); return }

    const parts = name.split(' ')
    const firstName = parts[0]
    const lastName = parts.slice(1).join(' ') || '-'
    const finalEmail = email || `${firstName.toLowerCase()}-va@placeholder.vaa`

    try {
      const fd = new FormData()
      fd.set('email', finalEmail)
      fd.set('firstName', firstName)
      fd.set('lastName', lastName)
      fd.set('systemRole', 'VA')
      fd.set('userType', 'VIRTUAL_ASSISTANT')
      await createUser(fd)
      toast.success(`${name} added to roster`)
      setOpen(false)
      form.reset()
      startTransition(() => router.refresh())
    } catch (e: any) {
      toast.error(e.message ?? 'Failed to add VA')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-accent/30 transition-colors text-left"
      >
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Add VA</span>
        <span className="text-xs text-muted-foreground">Quick data population — name only required</span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
        )}
      </button>

      {open && (
        <div className="border-t p-4">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Full Name *</label>
                <Input name="name" required placeholder="Juan Dela Cruz" className="h-8 text-xs mt-0.5" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email (optional)</label>
                <Input name="email" type="email" placeholder="juan@vaa.com" className="h-8 text-xs mt-0.5" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" className="h-7 text-xs" disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Adding...</>
                ) : (
                  <><UserPlus className="h-3 w-3 mr-1" /> Add VA</>
                )}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
