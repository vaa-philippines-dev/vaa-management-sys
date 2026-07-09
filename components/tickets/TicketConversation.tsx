'use client'

import { useRef } from 'react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { addTicketMessage } from '@/app/(dashboard)/tickets/actions'

type Message = {
  id: string
  message: string
  isInternalNote: boolean
  createdAt: Date
  user: { firstName: string | null; lastName: string | null; email: string }
}

export function TicketConversation({
  ticketId,
  messages,
  canWriteInternalNotes,
}: {
  ticketId: string
  messages: Message[]
  canWriteInternalNotes: boolean
}) {
  const formRef = useRef<HTMLFormElement>(null)

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No messages yet.</p>
      ) : (
        <div className="space-y-3">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg border p-3 ${m.isInternalNote ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900' : ''}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-medium">
                  {m.user.firstName || m.user.email}
                  {m.isInternalNote && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      Internal note
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{format(m.createdAt, 'MMM dd, yyyy h:mm a')}</p>
              </div>
              <p className="text-sm whitespace-pre-wrap">{m.message}</p>
            </div>
          ))}
        </div>
      )}

      <form
        ref={formRef}
        action={async (formData) => {
          await addTicketMessage(formData)
          formRef.current?.reset()
        }}
        className="space-y-2 pt-2 border-t"
      >
        <input type="hidden" name="ticketId" value={ticketId} />
        <Label htmlFor="message">Reply</Label>
        <textarea
          id="message"
          name="message"
          required
          rows={3}
          placeholder="Write a reply..."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          {canWriteInternalNotes ? (
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="isInternalNote" className="h-3.5 w-3.5" />
              Internal note (not visible to VA)
            </label>
          ) : (
            <span />
          )}
          <Button type="submit" size="sm">
            Send
          </Button>
        </div>
      </form>
    </div>
  )
}
