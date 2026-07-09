'use client'

import { useEffect, useRef, useState } from 'react'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'
import { setMessageColor } from '@/app/(dashboard)/inbox/actions'

const COLOR_SWATCH: Record<string, string> = {
  YELLOW: '#F5C518',
  BLUE: '#2E7BE0',
  RED: '#E5484D',
}

export function MessageColorPicker({
  color,
  onChange,
}: {
  color: 'RED' | 'BLUE' | 'YELLOW'
  onChange: (color: 'RED' | 'BLUE' | 'YELLOW') => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const pick = (next: 'RED' | 'BLUE' | 'YELLOW') => {
    setOpen(false)
    onChange(next)
    setMessageColor(next)
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Choose your message color"
        title="Message color"
        className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Palette className="h-3.5 w-3.5" style={{ color: COLOR_SWATCH[color] }} />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-1.5 flex items-center gap-1.5 rounded-lg border bg-popover px-2 py-1.5 shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
          {(['YELLOW', 'BLUE', 'RED'] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              aria-label={`Use ${c.toLowerCase()}`}
              className={cn(
                'h-5 w-5 rounded-full ring-offset-1 transition-transform hover:scale-110',
                color === c && 'ring-2 ring-foreground/40'
              )}
              style={{ backgroundColor: COLOR_SWATCH[c] }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
