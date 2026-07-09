'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

const SIZE = 180
const STROKE = 3
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function BrandedLoader() {
  const [stage, setStage] = useState<'enter' | 'settle'>('enter')
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const settleTimer = setTimeout(() => setStage('settle'), 150)
    return () => clearTimeout(settleTimer)
  }, [])

  useEffect(() => {
    const start = performance.now()
    // Eases toward 92% quickly, then creeps — finishes fast once real content is ready
    // and RootLoading unmounts, rather than pretending to know true load time.
    const tick = (now: number) => {
      const elapsed = now - start
      const eased = 92 * (1 - Math.exp(-elapsed / 900))
      setProgress(eased)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const dashOffset = CIRCUMFERENCE * (1 - progress / 100)

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-8 overflow-hidden">
      <div className="relative flex items-center justify-center" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 -rotate-90 transition-opacity duration-500"
          style={{ opacity: stage === 'settle' ? 1 : 0 }}
        >
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth={STROKE}
            className="text-black/[0.06] dark:text-white/[0.08]"
          />
          <defs>
            <linearGradient id="brandedLoaderRing" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F59B19" />
              <stop offset="100%" stopColor="#1E6991" />
            </linearGradient>
          </defs>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            stroke="url(#brandedLoaderRing)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 200ms linear' }}
          />
        </svg>

        <div
          className="relative transition-all ease-out"
          style={{
            transform: stage === 'settle' ? 'scale(1) rotate(0deg)' : 'scale(0.35) rotate(-8deg)',
            opacity: stage === 'settle' ? 1 : 0,
            transitionDuration: '650ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <Image
            src="/vaalogo.svg"
            alt="VAA Philippines"
            width={112}
            height={112}
            priority
          />
        </div>
      </div>
    </div>
  )
}
