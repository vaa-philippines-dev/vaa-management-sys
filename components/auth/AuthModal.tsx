'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import { LoginForm } from '@/components/auth/LoginForm'

type AuthModalProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AuthModal({ open, onOpenChange }: AuthModalProps) {
  useEffect(() => {
    if (!open) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = original
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onOpenChange])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 py-10"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
    >
      <div
        className="fixed inset-0 bg-overlay backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={() => onOpenChange(false)}
      />

      <div className="relative z-10 animate-in fade-in-0 zoom-in-95 duration-300">
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className="absolute -top-3 -right-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border bg-card text-muted-foreground shadow-md transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <LoginForm />
      </div>
    </div>
  )
}
