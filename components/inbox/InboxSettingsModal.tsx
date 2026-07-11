'use client'

import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { setMessageColor } from '@/app/(dashboard)/inbox/actions'

export type MessageColorValue = 'BLUE' | 'RED' | 'GREEN' | 'YELLOW' | 'BLACK'

const COLOR_SWATCH: Record<MessageColorValue, string> = {
  BLUE: '#0B84FE',
  RED: '#FF3B30',
  GREEN: '#33C759',
  YELLOW: '#FFCC00',
  BLACK: '#1C1C1E',
}

const COLOR_LABEL: Record<MessageColorValue, string> = {
  BLUE: 'Blue',
  RED: 'Red',
  GREEN: 'Green',
  YELLOW: 'Yellow',
  BLACK: 'Black',
}

const COLOR_ORDER: MessageColorValue[] = ['BLUE', 'RED', 'GREEN', 'YELLOW', 'BLACK']

export function InboxSettingsModal({
  open,
  onOpenChange,
  color,
  onChangeColor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  color: MessageColorValue
  onChangeColor: (color: MessageColorValue) => void
}) {
  const pick = (next: MessageColorValue) => {
    onChangeColor(next)
    setMessageColor(next)
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Inbox settings"
      description="Personalize how the Inbox looks and behaves for you."
      size="sm"
    >
      <div className="space-y-5">
        <section>
          <h3 className="text-xs font-semibold text-foreground">Message color</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Applied to your own message bubbles across every channel.
          </p>
          <div className="mt-3 flex items-center gap-3">
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => pick(c)}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-transform hover:scale-110',
                    color === c && 'ring-2 ring-foreground/50'
                  )}
                  style={{ backgroundColor: COLOR_SWATCH[c] }}
                />
                <span className="text-[10.5px] text-muted-foreground">{COLOR_LABEL[c]}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}
