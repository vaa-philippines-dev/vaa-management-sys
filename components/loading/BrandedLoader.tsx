'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

const TAGLINE = 'Our Experts . Your Growth'

export function BrandedLoader() {
  const [stage, setStage] = useState<'enter' | 'settle'>('enter')

  useEffect(() => {
    const settleTimer = setTimeout(() => setStage('settle'), 150)
    return () => clearTimeout(settleTimer)
  }, [])

  const renderTagline = () => {
    const chars = TAGLINE.split('')
    let eIndex = chars.findIndex((c) => c === 'E')
    if (eIndex === -1) eIndex = 3

    return chars.map((char, i) => (
      <span
        key={i}
        style={{ color: i === eIndex ? '#F59B19' : '#1E6991' }}
      >
        {char}
      </span>
    ))
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-10 overflow-hidden">
      <div className="relative flex items-center justify-center">
        <div
          className="absolute rounded-full blur-2xl transition-all ease-out"
          style={{
            width: 220,
            height: 220,
            background: 'radial-gradient(circle, rgba(30,105,145,0.25) 0%, rgba(245,155,25,0.12) 60%, transparent 80%)',
            opacity: stage === 'settle' ? 1 : 0,
            transform: stage === 'settle' ? 'scale(1)' : 'scale(0.6)',
            transitionDuration: '900ms',
          }}
        />

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
            width={200}
            height={200}
            priority
            className="drop-shadow-2xl"
          />
        </div>
      </div>

      <p
        className="text-3xl sm:text-4xl font-medium tracking-wide text-center transition-all ease-out"
        style={{
          fontFamily: 'var(--font-montserrat)',
          opacity: stage === 'settle' ? 1 : 0,
          transform: stage === 'settle' ? 'translateY(0)' : 'translateY(12px)',
          transitionDuration: '650ms',
          transitionDelay: '150ms',
        }}
      >
        {renderTagline()}
      </p>

      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full animate-bounce"
            style={{
              backgroundColor: i === 1 ? '#F59B19' : '#1E6991',
              animationDelay: `${i * 150}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>
    </div>
  )
}
