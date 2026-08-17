'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { MemberCombobox, type ComboboxOption } from '@/components/teams/MemberCombobox'
import { convertResignationIntake, dismissResignationIntake } from '@/app/(dashboard)/vas/actions'

export function IntakeReviewForm({
  intakeId,
  vaOptions,
}: {
  intakeId: string
  vaOptions: ComboboxOption[]
}) {
  const router = useRouter()
  const [vaProfileId, setVaProfileId] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState<'convert' | 'dismiss' | null>(null)

  const handleConvert = async () => {
    if (!vaProfileId) {
      toast.error('Select which VA this request is for.')
      return
    }
    setSaving('convert')
    try {
      const fd = new FormData()
      fd.set('vaProfileId', vaProfileId)
      const { terminationId } = await convertResignationIntake(intakeId, fd)
      toast.success('Resignation case started')
      router.push(`/offboarding/${terminationId}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to convert this request')
      setSaving(null)
    }
  }

  const handleDismiss = async () => {
    setSaving('dismiss')
    try {
      const fd = new FormData()
      fd.set('note', note)
      await dismissResignationIntake(intakeId, fd)
      toast.success('Request dismissed')
      router.push('/offboarding')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to dismiss this request')
      setSaving(null)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-xs font-medium mb-1 block">Which VA is this?</Label>
        <MemberCombobox
          options={vaOptions}
          value={vaProfileId}
          onSelect={setVaProfileId}
          disabled={!!saving}
          placeholder="Search VAs by name…"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <Button onClick={handleConvert} disabled={!!saving || !vaProfileId} className="flex-1">
          {saving === 'convert' ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> Starting…</> : 'Start Resignation Case'}
        </Button>
      </div>

      <div className="pt-3 border-t space-y-2">
        <Label htmlFor="dismissNote" className="text-xs font-medium block">Not a real request? Dismiss it</Label>
        <Textarea
          id="dismissNote"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Optional note (e.g. duplicate, mistaken submission)"
          disabled={!!saving}
        />
        <Button variant="outline" size="sm" onClick={handleDismiss} disabled={!!saving}>
          {saving === 'dismiss' ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Dismissing…</> : 'Dismiss Request'}
        </Button>
      </div>
    </div>
  )
}
