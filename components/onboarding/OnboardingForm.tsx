'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'
import { AddressFields } from '@/components/vas/AddressFields'
import { completeOnboarding } from '@/app/onboard/[token]/actions'

const EXT_NAME_OPTIONS = ['Jr.', 'Sr.', 'II', 'III', 'IV']

type Prefill = {
  middleName: string | null
  extName: string | null
  whatsappNumber: string | null
  gcashNumber: string | null
  houseNumber: string | null
  address: string | null
  zipCode: string | null
  landmark: string | null
  regionCode: string | null
  provinceCode: string | null
  cityCode: string | null
  barangayCode: string | null
  facebookName: string | null
  facebookUrl: string | null
  linkedinUrl: string | null
  passportNumber: string | null
  philhealthNumber: string | null
}

function Field({ name, label, defaultValue, placeholder, type }: { name: string; label: string; defaultValue?: string | null; placeholder?: string; type?: string }) {
  return (
    <div>
      <Label htmlFor={name} className="text-xs font-medium mb-1 block">{label}</Label>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} placeholder={placeholder} type={type ?? 'text'} className="h-9 text-sm" />
    </div>
  )
}

export function OnboardingForm({
  token,
  firstName,
  lastName,
  prefill,
}: {
  token: string
  firstName: string
  lastName: string
  prefill: Prefill
}) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const fd = new FormData(e.currentTarget)
    try {
      await completeOnboarding(token, fd)
      // completeOnboarding redirects on success — Next.js navigates via the
      // thrown NEXT_REDIRECT signal, so nothing else runs here on success.
    } catch (err: any) {
      if (err?.digest?.startsWith?.('NEXT_REDIRECT')) throw err
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div>
          <Label className="text-xs font-medium mb-1 block">First Name</Label>
          <Input value={firstName} disabled className="h-9 text-sm" />
        </div>
        <div>
          <Label className="text-xs font-medium mb-1 block">Last Name</Label>
          <Input value={lastName} disabled className="h-9 text-sm" />
        </div>
        <Field name="middleName" label="Middle Name" defaultValue={prefill.middleName} />
        <div>
          <Label htmlFor="extName" className="text-xs font-medium mb-1 block">Extension Name</Label>
          <select id="extName" name="extName" defaultValue={prefill.extName ?? ''} className="w-full h-9 text-sm rounded-md border bg-background px-2">
            <option value="">None</option>
            {EXT_NAME_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Contact</p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Field name="whatsappNumber" label="WhatsApp Number" defaultValue={prefill.whatsappNumber} placeholder="09171234567" />
          <Field name="gcashNumber" label="GCash Number" defaultValue={prefill.gcashNumber} placeholder="09171234567" />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Address</p>
        <AddressFields
          defaultValues={{
            regionCode: prefill.regionCode ?? undefined,
            provinceCode: prefill.provinceCode ?? undefined,
            cityCode: prefill.cityCode ?? undefined,
            barangayCode: prefill.barangayCode ?? undefined,
          }}
          namePrefix="address"
        />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Field name="houseNumber" label="House Number" defaultValue={prefill.houseNumber} placeholder="123" />
          <Field name="address" label="Building & Street Name" defaultValue={prefill.address} placeholder="Main St, Building A" />
          <Field name="zipCode" label="Zip Code" defaultValue={prefill.zipCode} placeholder="1000" />
          <Field name="landmark" label="Landmark" defaultValue={prefill.landmark} />
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-sm font-semibold">Other Details</p>
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
          <Field name="facebookName" label="Facebook Name" defaultValue={prefill.facebookName} />
          <Field name="facebookUrl" label="Facebook Profile URL" defaultValue={prefill.facebookUrl} />
          <Field name="linkedinUrl" label="LinkedIn URL" defaultValue={prefill.linkedinUrl} />
          <Field name="passportNumber" label="Passport Number" defaultValue={prefill.passportNumber} />
          <Field name="philhealthNumber" label="PhilHealth Number" defaultValue={prefill.philhealthNumber} />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={submitting}>
          {submitting ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Submitting...</> : 'Submit'}
        </Button>
      </div>
    </form>
  )
}
