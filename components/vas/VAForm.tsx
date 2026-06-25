'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useFormStatus } from 'react-dom'

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Saving...' : label}
    </Button>
  )
}

export function VAForm({
  action,
  va,
}: {
  action: (formData: FormData) => Promise<void>
  va?: {
    id: string
    phone: string | null
    hourlyRate: number | null
    notes: string | null
    isActive: boolean
    user: { name: string | null; email: string; department: string | null }
  }
}) {
  return (
    <form action={action} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          defaultValue={va?.user.name ?? ''}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          defaultValue={va?.user.email ?? ''}
          required
          disabled={!!va}
        />
      </div>

      {!va && (
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="department">Department</Label>
        <Input
          id="department"
          name="department"
          defaultValue={va?.user.department ?? ''}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone">Phone</Label>
        <Input id="phone" name="phone" defaultValue={va?.phone ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="hourlyRate">Hourly Rate ($)</Label>
        <Input
          id="hourlyRate"
          name="hourlyRate"
          type="number"
          step="0.01"
          defaultValue={va?.hourlyRate?.toString() ?? ''}
        />
      </div>

      {va && (
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            name="notes"
            className="min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
            defaultValue={va.notes ?? ''}
          />
        </div>
      )}

      <SubmitButton label={va ? 'Update VA' : 'Create VA'} />
    </form>
  )
}
