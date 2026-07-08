'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { transferVA } from '@/app/(dashboard)/vas/actions'

type DepartmentOption = { id: string; name: string; positions: { id: string; title: string }[] }

const TRANSFER_TYPE_OPTIONS = [
  { value: 'ACTIVE', label: 'Transfer — remain active', description: 'Ends current department membership, starts a new one.' },
  { value: 'END_OF_CONTRACT', label: 'Transfer — end of contract', description: 'Closes out the current contract, then onboards to the new department.' },
  { value: 'HYBRID', label: 'Hybrid — split across both', description: 'Keeps the current department active and adds a second, concurrent one.' },
] as const

export function TransferVAModal({
  vaProfileId,
  currentDepartmentName,
  departments,
  canEdit,
}: {
  vaProfileId: string
  currentDepartmentName: string | null
  departments: DepartmentOption[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [transferType, setTransferType] = useState<'ACTIVE' | 'END_OF_CONTRACT' | 'HYBRID'>('ACTIVE')
  const [departmentId, setDepartmentId] = useState('')
  const [positionId, setPositionId] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [reason, setReason] = useState('')
  const [hourlyRate, setHourlyRate] = useState('')
  const [baseRate, setBaseRate] = useState('')
  const [saving, setSaving] = useState(false)

  const selectedDept = departments.find((d) => d.id === departmentId)

  const reset = () => {
    setTransferType('ACTIVE')
    setDepartmentId('')
    setPositionId('')
    setEffectiveDate(format(new Date(), 'yyyy-MM-dd'))
    setReason('')
    setHourlyRate('')
    setBaseRate('')
  }

  const handleSubmit = async () => {
    if (!departmentId) {
      toast.error('Select a destination department')
      return
    }
    setSaving(true)
    try {
      await transferVA(
        vaProfileId,
        transferType,
        departmentId,
        positionId || null,
        effectiveDate,
        reason || undefined,
        hourlyRate ? Number(hourlyRate) : undefined,
        baseRate ? Number(baseRate) : undefined
      )
      toast.success('VA transferred')
      setOpen(false)
      reset()
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to transfer VA')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) return null

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOpen(true)}>
        <ArrowLeftRight className="h-3.5 w-3.5 mr-1.5" />
        Transfer Department
      </Button>

      <Modal
        open={open}
        onOpenChange={(o) => { setOpen(o); if (!o) reset() }}
        title="Transfer VA to Another Department"
        description={currentDepartmentName ? `Currently in ${currentDepartmentName}.` : undefined}
        size="md"
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} className="inline-flex items-center justify-center rounded-lg border bg-background hover:bg-muted text-xs font-medium h-8 px-3 transition-colors">
              Cancel
            </button>
            <Button type="button" size="sm" className="text-xs h-8" disabled={saving || !departmentId} onClick={handleSubmit}>
              {saving ? <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Transferring...</> : 'Confirm Transfer'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Transfer Type</Label>
            <div className="space-y-1.5">
              {TRANSFER_TYPE_OPTIONS.map((opt) => (
                <label key={opt.value} className="flex items-start gap-2 rounded-lg border p-2 cursor-pointer hover:bg-muted/40 transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="transferType"
                    value={opt.value}
                    checked={transferType === opt.value}
                    onChange={() => setTransferType(opt.value)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-xs font-medium">{opt.label}</p>
                    <p className="text-[11px] text-muted-foreground">{opt.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Destination Department</Label>
              <select
                value={departmentId}
                onChange={(e) => { setDepartmentId(e.target.value); setPositionId('') }}
                className="w-full h-8 text-xs rounded-md border bg-background px-2"
              >
                <option value="">Select department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Position</Label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                disabled={!selectedDept}
                className="w-full h-8 text-xs rounded-md border bg-background px-2 disabled:opacity-60"
              >
                <option value="">— Not set —</option>
                {selectedDept?.positions.map((p) => (
                  <option key={p.id} value={p.id}>{p.title}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Hourly Rate (optional)</Label>
              <Input type="number" value={hourlyRate} onChange={(e) => setHourlyRate(e.target.value)} placeholder="Use default" className="h-8 text-xs" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Base Rate (optional)</Label>
              <Input type="number" value={baseRate} onChange={(e) => setBaseRate(e.target.value)} placeholder="Use default" className="h-8 text-xs" />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Client reassignment" className="h-8 text-xs" />
          </div>
        </div>
      </Modal>
    </>
  )
}
