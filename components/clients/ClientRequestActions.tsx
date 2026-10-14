'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Modal } from '@/components/ui/modal'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu'
import { ConfirmDialog } from '@/components/inbox/ConfirmDialog'
import { Ban, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cancelClientRequest, reopenClientRequest, removeClientRequest } from '@/app/(dashboard)/clients/actions'

export type ClientRequestActionsData = {
  id: string
  name: string
  status: string
  // Any status — a request with assignment history can only be cancelled.
  assignmentCount: number
  // Active / paused / on hold — these block cancelling.
  openAssignmentCount: number
}

// The viewer's own calendar date — toISOString() would be yesterday's in
// Manila until 8AM.
function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Cancel / reopen / remove for one client request, as a "⋯" menu. Used on the
// /clients cards and list rows and on the request's own page.
export function ClientRequestActions({
  client,
  className,
  afterRemoveHref,
}: {
  client: ClientRequestActionsData
  className?: string
  // Where to go once the request is gone (its own page would 404).
  afterRemoveHref?: string
}) {
  const router = useRouter()
  const [cancelOpen, setCancelOpen] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  const cancelled = client.status === 'CANCELLED'
  const canRemove = client.assignmentCount === 0
  const today = localToday()

  const onCancel = async (formData: FormData) => {
    setSaving(true)
    try {
      await cancelClientRequest(client.id, {
        cancelledAt: String(formData.get('cancelledAt') ?? ''),
        reason: String(formData.get('reason') ?? ''),
      })
      toast.success(`"${client.name}" cancelled`)
      setCancelOpen(false)
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel the request')
    } finally {
      setSaving(false)
    }
  }

  const onReopen = () =>
    startTransition(async () => {
      try {
        await reopenClientRequest(client.id)
        toast.success(`"${client.name}" reopened as Pending`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not reopen the request')
      }
    })

  const onRemove = () => {
    setRemoveOpen(false)
    startTransition(async () => {
      try {
        await removeClientRequest(client.id)
        toast.success(`"${client.name}" removed`)
        if (afterRemoveHref) router.push(afterRemoveHref)
        else router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Could not remove the request')
      }
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${client.name} options`}
          disabled={isPending}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground',
            className
          )}
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          {cancelled ? (
            <DropdownMenuItem onClick={onReopen}>
              <RotateCcw className="h-3.5 w-3.5" />
              Reopen request
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setCancelOpen(true)}>
              <Ban className="h-3.5 w-3.5" />
              Cancel request
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" disabled={!canRemove} onClick={() => setRemoveOpen(true)}>
            <Trash2 className="h-3.5 w-3.5" />
            {canRemove ? 'Remove request' : 'Remove (has assignments)'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Modal
        open={cancelOpen}
        onOpenChange={(next) => {
          if (!next) setCancelOpen(false)
        }}
        title="Cancel client request"
        description={client.name}
        size="sm"
      >
        {client.openAssignmentCount > 0 ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {client.openAssignmentCount} VA assignment{client.openAssignmentCount === 1 ? ' is' : 's are'} still active or
              paused on this request. Cancel or end {client.openAssignmentCount === 1 ? 'it' : 'them'} from the request&apos;s
              page first, then cancel the request.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                Back
              </Button>
              <Button type="button" onClick={() => router.push(`/clients/${client.id}`)}>
                Open request
              </Button>
            </div>
          </div>
        ) : (
          <form action={onCancel} className="space-y-3">
            <div>
              <Label htmlFor="cancelledAt">Cancelled on</Label>
              <Input id="cancelledAt" name="cancelledAt" type="date" required defaultValue={today} max={today} />
              <p className="text-xs text-muted-foreground mt-1">Defaults to today — pick an earlier day if it already happened.</p>
            </div>
            <div>
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea id="reason" name="reason" rows={2} placeholder="e.g. client found a VA elsewhere" />
            </div>
            <p className="text-xs text-muted-foreground">
              The request stays on record under EOC / Cancelled and can be reopened.
            </p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCancelOpen(false)}>
                Back
              </Button>
              <Button type="submit" variant="destructive" disabled={saving}>
                {saving ? 'Saving...' : 'Cancel request'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={removeOpen}
        title={`Remove "${client.name}"?`}
        description="This permanently deletes the request — use it for duplicates or requests entered by mistake. To keep it on record, cancel it instead."
        confirmLabel="Remove request"
        onConfirm={onRemove}
        onCancel={() => setRemoveOpen(false)}
      />
    </>
  )
}
