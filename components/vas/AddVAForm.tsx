'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, Plus, X, UserPlus } from 'lucide-react'
import { createUser } from '@/app/(dashboard)/admin/users/actions'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

export function AddVAModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  if (!open) return null

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
      toast.success(`${name} added`)
      onClose()
      form.reset()
      startTransition(() => router.refresh())
    } catch (e: any) {
      toast.error(e.message ?? 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-card border rounded-xl shadow-2xl w-full max-w-md mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Add VA to Roster</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 hover:bg-accent rounded">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Full Name</label>
            <Input name="name" required placeholder="Juan Dela Cruz" className="h-9 text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">
              Optional email will be auto-generated if blank
            </p>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Email</label>
            <Input name="email" type="email" placeholder="juan@vaa.com" className="h-9 text-sm" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" className="h-8" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Adding...</>
              ) : (
                <><Plus className="h-3.5 w-3.5 mr-1" /> Add</>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
