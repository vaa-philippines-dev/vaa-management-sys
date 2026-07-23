'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter, unstable_rethrow } from 'next/navigation'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createClient } from '@/app/(dashboard)/clients/actions'
import { INTAKE_FIELD_CATALOG, getIntakeFieldsForDepartment, type IntakeFieldKey } from '@/lib/clients/intake-fields'
import {
  REQUEST_TYPE_OPTIONS,
  SCHEDULE_TYPE_OPTIONS,
  BRAND_OWNERSHIP_OPTIONS,
  BRAND_REGISTRATION_OPTIONS,
  getBusinessModelOptions,
  getServiceTypeOptions,
} from '@/lib/clients/form-options'

const SELECT_CLASS = 'flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'

export type AddClientDepartmentOption = { id: string; name: string; shortName: string | null; acronym: string | null }

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">{children}</p>
}

// A dropdown when this department has known options, otherwise a plain text
// input — inventing options we don't have real data for would just be wrong.
function SelectOrText({ name, label, options }: { name: string; label: string; options: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      {options.length > 0 ? (
        <select id={name} name={name} defaultValue="" className={SELECT_CLASS}>
          <option value="">Select…</option>
          {options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      ) : (
        <Input id={name} name={name} className="h-9" placeholder="No preset options for this department yet" />
      )}
    </div>
  )
}

export function AddClientModal({
  departments,
  managerId,
  open,
  onClose,
}: {
  departments: AddClientDepartmentOption[]
  managerId: string
  open: boolean
  onClose: () => void
}) {
  const router = useRouter()
  const [departmentId, setDepartmentId] = useState('')
  const [isPending, startTransition] = useTransition()

  const selectedDepartment = departments.find((d) => d.id === departmentId)
  const intakeKeys = useMemo(() => getIntakeFieldsForDepartment(selectedDepartment), [selectedDepartment])
  const businessModelOptions = useMemo(() => getBusinessModelOptions(selectedDepartment), [selectedDepartment])
  const serviceTypeOptions = useMemo(() => getServiceTypeOptions(selectedDepartment), [selectedDepartment])

  const reset = () => setDepartmentId('')

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await createClient(formData)
      } catch (err) {
        // createClient redirects to the new client's page on success, which
        // Next.js implements by throwing — let that propagate instead of
        // showing it as a failure toast.
        unstable_rethrow(err)
        toast.error(err instanceof Error ? err.message : 'Failed to create client')
        return
      }
      reset()
      onClose()
      router.refresh()
    })
  }

  const renderIntakeField = (key: IntakeFieldKey) => {
    const field = INTAKE_FIELD_CATALOG[key]
    if (field.type === 'checkbox-group') {
      return (
        <div key={key} className="space-y-1.5 md:col-span-2">
          <Label>{field.label}</Label>
          <div className="flex flex-wrap gap-3">
            {field.options.map((o) => (
              <label key={o} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" name={key} value={o} className="h-3.5 w-3.5" />
                {o}
              </label>
            ))}
          </div>
        </div>
      )
    }
    return (
      <div key={key} className="space-y-1.5 md:col-span-2">
        <Label htmlFor={key}>{field.label}</Label>
        <Textarea id={key} name={key} className="min-h-20 text-sm" />
      </div>
    )
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Add Client Record"
      description="Every field except Company Name is optional — fill in what you have now."
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="add-client-form" size="sm" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create Client'}
          </Button>
        </>
      }
    >
      <form id="add-client-form" onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="managerId" value={managerId} />

        <div className="space-y-1.5">
          <Label htmlFor="meetingDate">Meeting Date</Label>
          <Input id="meetingDate" name="meetingDate" type="date" className="h-9 max-w-[180px]" />
        </div>

        <SectionTitle>Request Information</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="departmentId">Department</Label>
            <select
              id="departmentId"
              name="departmentId"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className={SELECT_CLASS}
            >
              <option value="">Select a department…</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <SelectOrText name="businessModel" label="Business Model" options={businessModelOptions} />
          <SelectOrText name="serviceType" label="Service Type" options={serviceTypeOptions} />
          <div className="space-y-1.5">
            <Label htmlFor="requestType">Type</Label>
            <select id="requestType" name="requestType" defaultValue="" className={SELECT_CLASS}>
              <option value="">Select…</option>
              {REQUEST_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        <SectionTitle>Customer Information</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="contactName">Primary Account Name</Label>
            <Input id="contactName" name="contactName" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="secondaryContact">Secondary Contact</Label>
            <Input id="secondaryContact" name="secondaryContact" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactEmail">Email Address</Label>
            <Input id="contactEmail" name="contactEmail" type="email" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contactPhone">WhatsApp Number</Label>
            <Input id="contactPhone" name="contactPhone" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Company Name *</Label>
            <Input id="name" name="name" required className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="timezone">Timezone</Label>
            <Input id="timezone" name="timezone" className="h-9" />
          </div>
        </div>

        <SectionTitle>Company Information</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="companyBackground">Company/Client Background</Label>
            <Textarea id="companyBackground" name="companyBackground" className="min-h-20 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="website">Website</Label>
            <Input id="website" name="website" type="url" className="h-9" />
          </div>
          <div />
          <div className="space-y-1.5">
            <Label htmlFor="brands">Brand/s</Label>
            <Textarea id="brands" name="brands" className="min-h-16 text-sm" placeholder="One per line" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brandOwnership">Brand Ownership</Label>
            <select id="brandOwnership" name="brandOwnership" defaultValue="" className={SELECT_CLASS}>
              <option value="">Select…</option>
              {BRAND_OWNERSHIP_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="productNiche">Product Background / Niche</Label>
            <Textarea id="productNiche" name="productNiche" className="min-h-16 text-sm" placeholder="One per line" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brandRegistration">Brand Registration</Label>
            <select id="brandRegistration" name="brandRegistration" defaultValue="" className={SELECT_CLASS}>
              <option value="">Select…</option>
              {BRAND_REGISTRATION_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="productLinks">Product and Link/s</Label>
            <Textarea id="productLinks" name="productLinks" className="min-h-16 text-sm" placeholder="One per line" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="marketplace">Marketplace</Label>
            <Textarea id="marketplace" name="marketplace" className="min-h-16 text-sm" />
          </div>
        </div>

        {departmentId && intakeKeys.length > 0 && (
          <>
            <SectionTitle>Account Information</SectionTitle>
            <div className="grid gap-3 md:grid-cols-2">
              {intakeKeys.map((key) => renderIntakeField(key))}
            </div>
          </>
        )}

        <SectionTitle>Other Information</SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="dailyTasks">Daily Tasks</Label>
            <Textarea id="dailyTasks" name="dailyTasks" className="min-h-20 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tools">Tools</Label>
            <Textarea id="tools" name="tools" className="min-h-20 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="scheduleType">Schedule Type</Label>
            <select id="scheduleType" name="scheduleType" defaultValue="" className={SELECT_CLASS}>
              <option value="">Select…</option>
              {SCHEDULE_TYPE_OPTIONS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="averageWorkHours">Average Work Hours</Label>
            <Input id="averageWorkHours" name="averageWorkHours" className="h-9" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="scheduleDays">Schedule Days</Label>
            <Textarea
              id="scheduleDays"
              name="scheduleDays"
              className="min-h-16 text-sm"
              placeholder="e.g. Monday - Friday 9AM to 12PM PHT. For flexible schedules, note specific hours available for meetings with the client."
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="scheduleNotes">Schedule Notes</Label>
            <Textarea id="scheduleNotes" name="scheduleNotes" className="min-h-16 text-sm" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="vaRequirements">VA Requirements / Request, Limitation and Disclaimer</Label>
            <Textarea id="vaRequirements" name="vaRequirements" className="min-h-20 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vaConnectionDate">VA Connection Date (PHT)</Label>
            <Input id="vaConnectionDate" name="vaConnectionDate" type="date" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="targetStartDate">Target Start Date (PHT)</Label>
            <Input id="targetStartDate" name="targetStartDate" type="date" className="h-9" />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea id="notes" name="notes" className="min-h-20 text-sm" />
          </div>
        </div>
      </form>
    </Modal>
  )
}
