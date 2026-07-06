'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'

export function BrandedLoader() {
  const [stage, setStage] = useState<'enter' | 'settle'>('enter')

  useEffect(() => {
    const settleTimer = setTimeout(() => setStage('settle'), 150)
    return () => clearTimeout(settleTimer)
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] gap-10 overflow-hidden">
      <div className="relative flex items-center justify-center">
        <div
          className="relative flex h-[13rem] w-[13rem] items-center justify-center transition-all ease-out"
          style={{
            transform: stage === 'settle' ? 'scale(1) rotate(0deg)' : 'scale(0.35) rotate(-8deg)',
            opacity: stage === 'settle' ? 1 : 0,
            transitionDuration: '650ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          <div className="relative z-10 flex flex-col items-center">
            <Image
              src="/vaalogo.svg"
              alt="VAA Philippines Logo"
              width={140}
              height={140}
              className="drop-shadow-2xl mb-8"
            />
            <p className="mt-3 text-lg text-white/80" style={{ fontFamily: 'var(--font-montserrat)' }}>
              Our <span style={{ color: '#F59B19' }}>E</span>xperts . Your Growth
            </p>
          </div>
        </div>
      </div>

      <p
        className="whitespace-nowrap text-center font-semibold leading-none tracking-[0.10em] transition-all ease-out"
        style={{
          fontFamily: 'var(--font-montserrat)',
          color: '#176E9C',
          fontSize: 'clamp(0.2rem, 4.0vw, 0.8rem)',
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
              backgroundColor: i === 1 ? '#F59822' : '#176E9C',
              animationDelay: `${i * 150}ms`,
              animationDuration: '900ms',
            }}
          />
        ))}
      </div>
    </div>
  )
}
