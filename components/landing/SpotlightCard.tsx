'use client'

import { useRef, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

type SpotlightCardProps = {
  children: React.ReactNode
  className?: string
  accent?: string
}

export function SpotlightCard({ children, className, accent = 'var(--foreground)' }: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x: 50, y: 0 })

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    })
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:border-transparent hover:shadow-xl',
        className
      )}
      style={{ '--spot-accent': accent } as CSSProperties}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(360px circle at ${pos.x}% ${pos.y}%, color-mix(in srgb, var(--spot-accent) 16%, transparent), transparent 70%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background: `radial-gradient(360px circle at ${pos.x}% ${pos.y}%, color-mix(in srgb, var(--spot-accent) 45%, transparent), transparent 70%)`,
          mask: 'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          maskComposite: 'xor',
          WebkitMaskComposite: 'xor',
          padding: 1,
        }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  )
}
