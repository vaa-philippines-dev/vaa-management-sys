'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { FI } from '@/components/vas/VAProfileEditor'
import { addStaff } from '@/app/(dashboard)/staff/actions'
import { createVAOnboardingInvite } from '@/app/(dashboard)/vas/actions'

// The Staff Masterlist's counterpart to QuickAddVABtn: a STAFF account plus
// its first engagement, optionally with an onboarding link generated right away.
export function AddStaffBtn({ departments }: { departments: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [withInvite, setWithInvite] = useState(true)
  const [inviteLink, setInviteLink] = useState<string | null>(null)

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { recordId, userId } = await addStaff(new FormData(e.currentTarget))
      if (withInvite) {
        const { token } = await createVAOnboardingInvite(userId)
        setInviteLink(`${window.location.origin}/onboard/${token}`)
        toast.success('Staff added — copy the onboarding link below')
        router.refresh()
      } else {
        toast.success('Staff added')
        setOpen(false)
        router.push(`/staff/${recordId}`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add staff')
    } finally {
      setSaving(false)
    }
  }

  const close = () => {
    setOpen(false)
    setInviteLink(null)
  }

  return (
    <>
      <Button size="sm" className="h-8 text-xs gap-1" onClick={() => setOpen(true)}>
        <Plus className="h-3.5 w-3.5" /> Add Staff
      </Button>
      <Modal open={open} onOpenChange={(o) => (o ? setOpen(true) : close())} title="Add Staff" description="Creates a STAFF login and their first engagement." size="sm">
        {inviteLink ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Send this onboarding link to the new staff member:</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="flex-1 h-8 text-xs rounded-md border bg-muted/30 px-2" />
              <Button size="sm" className="h-8 text-xs" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success('Link copied') }}>Copy</Button>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              <FI name="firstName" label="First Name" />
              <FI name="lastName" label="Last Name" />
              <div className="sm:col-span-2"><FI name="email" label="Login Email" type="email" placeholder="name@gmail.com" /></div>
              <FI name="workEmail" label="Work Email" type="email" />
              <FI name="hireDate" label="Hire Date" type="date" />
              <div>
                <label htmlFor="add-staff-dept" className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Department</label>
                <input id="add-staff-dept" name="department" list="staff-departments" className="w-full h-8 text-xs rounded-md border bg-background px-2" />
                <datalist id="staff-departments">
                  {departments.map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
              <FI name="subdepartment" label="Subdepartment" />
              <FI name="position" label="Position" />
              <FI name="level" label="Level" />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input type="checkbox" checked={withInvite} onChange={(e) => setWithInvite(e.target.checked)} className="rounded" />
              Generate an onboarding link
            </label>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={close}>Cancel</Button>
              <Button type="submit" size="sm" className="h-8 text-xs" disabled={saving}>
                {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Adding...</> : 'Add Staff'}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}
