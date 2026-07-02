'use client'

import { useState, useEffect, useRef } from 'react'
import { BrandedLoader } from '@/components/loading/BrandedLoader'

export function PostLoginGate({ children }: { children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'done'>(() => {
    if (typeof document === 'undefined') return 'done'
    if (document.cookie.includes('vaa_just_logged_in=1')) {
      document.cookie = 'vaa_just_logged_in=; path=/; max-age=0'
      return 'loading'
    }
    return 'done'
  })
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (phase === 'loading') {
      timerRef.current = setTimeout(() => setPhase('done'), 2500)
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [phase])

  if (phase === 'loading') return <BrandedLoader />

  return <>{children}</>
}
