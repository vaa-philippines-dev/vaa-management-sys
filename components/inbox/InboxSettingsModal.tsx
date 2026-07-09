'use client'

import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { setMessageColor } from '@/app/(dashboard)/inbox/actions'

const COLOR_SWATCH: Record<string, string> = {
  YELLOW: '#F5C518',
  BLUE: '#2E7BE0',
  RED: '#E5484D',
}

const COLOR_LABEL: Record<string, string> = {
  YELLOW: 'Yellow',
  BLUE: 'Blue',
  RED: 'Red',
}

export function InboxSettingsModal({
  open,
  onOpenChange,
  color,
  onChangeColor,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  color: 'RED' | 'BLUE' | 'YELLOW'
  onChangeColor: (color: 'RED' | 'BLUE' | 'YELLOW') => void
}) {
  const pick = (next: 'RED' | 'BLUE' | 'YELLOW') => {
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
            {(['YELLOW', 'BLUE', 'RED'] as const).map((c) => (
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
