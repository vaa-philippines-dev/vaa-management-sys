'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border transition-colors duration-300',
        isDark ? 'border-white/15 bg-white/10' : 'border-black/10 bg-black/[0.04]'
      )}
    >
      <span
        className={cn(
          'absolute left-1 flex h-6 w-6 items-center justify-center rounded-full bg-background shadow-md transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] will-change-transform',
          isDark && 'translate-x-6'
        )}
      >
        <Sun
          className={cn(
            'absolute h-3.5 w-3.5 text-foreground/70 transition-all duration-300',
            isDark ? 'scale-0 rotate-90 opacity-0' : 'scale-100 rotate-0 opacity-100'
          )}
        />
        <Moon
          className={cn(
            'absolute h-3.5 w-3.5 text-foreground/70 transition-all duration-300',
            isDark ? 'scale-100 rotate-0 opacity-100' : 'scale-0 -rotate-90 opacity-0'
          )}
        />
      </span>
    </button>
  )
}
