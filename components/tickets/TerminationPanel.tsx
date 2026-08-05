'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { format } from 'date-fns'
import { updateExitClearance } from '@/app/(dashboard)/vas/actions'

const TYPE_LABEL: Record<string, string> = {
  EOC: 'Type A — End of Contract',
  CLIENT_INITIATED: 'Type B — Client-Initiated',
  VAA_INITIATED: 'Type C — VAA-Initiated',
}

const WORKFLOW_LABEL: Record<string, string> = {
  INITIATED: 'Initiated',
  EXIT_SURVEY_PENDING: 'Awaiting Exit Survey',
  CLEARANCE_PENDING: 'Awaiting Clearance',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const CHECKLIST_ITEMS: { key: 'equipmentReturned' | 'accountsRevoked' | 'documentsSubmitted' | 'finalPayCleared'; label: string }[] = [
  { key: 'equipmentReturned', label: 'Equipment returned' },
  { key: 'accountsRevoked', label: 'Accounts revoked' },
  { key: 'documentsSubmitted', label: 'Documents submitted' },
  { key: 'finalPayCleared', label: 'Final pay cleared' },
]

type Clearance = {
  id: string
  equipmentReturned: boolean
  accountsRevoked: boolean
  documentsSubmitted: boolean
  finalPayCleared: boolean
  outstandingBalanceNote: string | null
}

export function TerminationPanel({
  termination,
  canEdit,
}: {
  termination: {
    id: string
    type: string
    affectsBothParties: boolean
    resultingStatus: string
    workflowStatus: string
    effectiveDate: string
    vaProfileId: string
    vaName: string
    clientName: string | null
    exitSurvey: { completed: boolean; expiresAt: string } | null
    clearance: Clearance | null
  }
  canEdit: boolean
}) {
  const [clearance, setClearance] = useState(termination.clearance)
  const [note, setNote] = useState(termination.clearance?.outstandingBalanceNote ?? '')
  const [isPending, startTransition] = useTransition()

  const toggleItem = (key: (typeof CHECKLIST_ITEMS)[number]['key']) => {
    if (!clearance || !canEdit) return
    const next = { ...clearance, [key]: !clearance[key] }
    setClearance(next)
    startTransition(async () => {
      const fd = new FormData()
      for (const item of CHECKLIST_ITEMS) fd.set(item.key, String(next[item.key]))
      fd.set('outstandingBalanceNote', note)
      await updateExitClearance(clearance.id, fd)
    })
  }

  const saveNote = () => {
    if (!clearance || !canEdit) return
    startTransition(async () => {
      const fd = new FormData()
      for (const item of CHECKLIST_ITEMS) fd.set(item.key, String(clearance[item.key]))
      fd.set('outstandingBalanceNote', note)
      await updateExitClearance(clearance.id, fd)
    })
  }

  return (
    <Card className="border-destructive/30">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          Termination
          <Badge variant="outline" className="text-[10px]">{WORKFLOW_LABEL[termination.workflowStatus] ?? termination.workflowStatus}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground mb-1">VA</p>
          <Link href={`/vas/${termination.vaProfileId}`} className="font-medium text-primary hover:underline">
            {termination.vaName}
          </Link>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Scope</p>
          <p className="font-medium">{termination.clientName ? `Assignment — ${termination.clientName}` : 'Entire VA (all assignments)'}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Classification</p>
          <p className="font-medium">{TYPE_LABEL[termination.type] ?? termination.type}{termination.affectsBothParties ? ' · Affects both parties' : ''}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Resulting Status</p>
          <p className="font-medium">{termination.resultingStatus.replace(/_/g, ' ')}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Effective Date</p>
          <p className="font-medium">{format(new Date(termination.effectiveDate), 'MMM dd, yyyy')}</p>
        </div>

        {termination.exitSurvey && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Exit Survey</p>
            <p className="font-medium">
              {termination.exitSurvey.completed ? 'Submitted' : `Pending — link expires ${format(new Date(termination.exitSurvey.expiresAt), 'MMM dd, yyyy')}`}
            </p>
          </div>
        )}

        {clearance && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Exit Clearance</p>
            <div className="space-y-1.5">
              {CHECKLIST_ITEMS.map((item) => (
                <label key={item.key} className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={clearance[item.key]}
                    disabled={!canEdit || isPending}
                    onChange={() => toggleItem(item.key)}
                    className="rounded"
                  />
                  {item.label}
                </label>
              ))}
            </div>
            <div className="mt-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-1 block">Outstanding Balance Note</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={saveNote}
                disabled={!canEdit}
                placeholder="e.g. Device loan pending return"
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
