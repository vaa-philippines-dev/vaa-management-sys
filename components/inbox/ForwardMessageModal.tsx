'use client'

import { useState, useTransition } from 'react'
import { Hash } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/modal'
import { forwardMessage } from '@/app/(dashboard)/inbox/actions'

type ChannelOption = { channelId: string; departmentName: string }

export function ForwardMessageModal({
  open,
  onOpenChange,
  messageId,
  currentChannelId,
  channels,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  messageId: string | null
  currentChannelId: string
  channels: ChannelOption[]
}) {
  const [isPending, startTransition] = useTransition()
  const [forwardingTo, setForwardingTo] = useState<string | null>(null)

  const handleForward = (channel: ChannelOption) => {
    if (!messageId || isPending) return
    setForwardingTo(channel.channelId)
    startTransition(async () => {
      await forwardMessage(messageId, channel.channelId)
      toast.success(`Forwarded to #${channel.departmentName}`)
      setForwardingTo(null)
      onOpenChange(false)
    })
  }

  const options = channels.filter((c) => c.channelId !== currentChannelId)

  return (
    <Modal open={open} onOpenChange={onOpenChange} title="Forward message" size="sm">
      {options.length === 0 ? (
        <p className="text-xs text-muted-foreground">No other channels to forward to.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {options.map((c) => (
            <button
              key={c.channelId}
              type="button"
              disabled={isPending}
              onClick={() => handleForward(c)}
              className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            >
              <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
              <span className="truncate flex-1">{c.departmentName}</span>
              {forwardingTo === c.channelId && <span className="text-[10px]">Forwarding...</span>}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
