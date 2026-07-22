'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { updateClient } from '@/app/(dashboard)/clients/actions'
import { CLIENT_STATUS_LABEL } from '@/lib/clients/display'

const PLATFORMS = [
  { value: 'AMAZON', label: 'Amazon' },
  { value: 'WALMART', label: 'Walmart' },
  { value: 'TIKTOK_SHOP', label: 'TikTok Shop' },
  { value: 'SHOPIFY', label: 'Shopify' },
  { value: 'MULTI', label: 'Multi-platform' },
]

const SELECT_CLASS = 'flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'

export type ClientEditData = {
  id: string
  name: string
  contactName: string | null
  contactEmail: string | null
  contactPhone: string | null
  platform: string
  industry: string | null
  timezone: string | null
  website: string | null
  notes: string | null
  status: string
  onHold: boolean
  isActive: boolean
  managerId: string | null
  departmentId: string | null
  requiredSkills: string[]
}

export function ClientEditModal({
  client,
  departments,
  managers,
  skills,
  open,
  onClose,
}: {
  client: ClientEditData
  departments: { id: string; name: string }[]
  managers: { id: string; firstName: string; lastName: string | null; email: string }[]
  skills: string[]
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [selectedSkills, setSelectedSkills] = useState<string[]>(client.requiredSkills)
  const [isPending, startTransition] = useTransition()

  const toggleSkill = (s: string) => {
    setSelectedSkills((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await updateClient(client.id, formData)
        toast.success('Client updated')
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update client')
      }
    })
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={`Edit ${client.name}`}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="client-edit-form" size="sm" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </>
      }
    >
      <form id="client-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Client / Brand Name *</Label>
          <Input id="name" name="name" required defaultValue={client.name} className="h-9" />
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Contact Name</Label>
            <Input id="contactName" name="contactName" defaultValue={client.contactName ?? ''} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Contact Email</Label>
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={client.contactEmail ?? ''} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">Contact Phone</Label>
            <Input id="contactPhone" name="contactPhone" defaultValue={client.contactPhone ?? ''} className="h-9" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="platform">Platform</Label>
            <select id="platform" name="platform" defaultValue={client.platform} className={SELECT_CLASS}>
              {PLATFORMS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="industry">Industry / Niche</Label>
            <Input id="industry" name="industry" defaultValue={client.industry ?? ''} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" defaultValue={client.timezone ?? ''} className="h-9" />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="departmentId">Department</Label>
            <select id="departmentId" name="departmentId" defaultValue={client.departmentId ?? ''} className={SELECT_CLASS}>
              <option value="">No department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="managerId">Manager</Label>
            <select id="managerId" name="managerId" defaultValue={client.managerId ?? ''} className={SELECT_CLASS}>
              <option value="">No manager</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>{[m.firstName, m.lastName].filter(Boolean).join(' ') || m.email}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select id="status" name="status" defaultValue={client.status} className={SELECT_CLASS}>
              {Object.entries(CLIENT_STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" defaultValue={client.website ?? ''} className="h-9" />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="onHold" defaultChecked={client.onHold} className="h-3.5 w-3.5" />
            On Hold
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isActive" defaultChecked={client.isActive} className="h-3.5 w-3.5" />
            Active
          </label>
        </div>

        {skills.length > 0 && (
          <div className="space-y-1.5">
            <Label>Required Services</Label>
            <div className="flex flex-wrap gap-2">
              {skills.map((s) => (
                <button type="button" key={s} onClick={() => toggleSkill(s)} className="focus:outline-none">
                  <Badge variant={selectedSkills.includes(s) ? 'default' : 'outline'} className="cursor-pointer">
                    {s}
                  </Badge>
                </button>
              ))}
            </div>
            {selectedSkills.map((s) => (
              <input key={s} type="hidden" name="requiredSkills" value={s} />
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea id="notes" name="notes" defaultValue={client.notes ?? ''} className="min-h-24 text-sm" />
        </div>
      </form>
    </Modal>
  )
}
