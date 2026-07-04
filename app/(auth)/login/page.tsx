'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { SupportRequestModal } from '@/components/auth/SupportRequestModal'
import { RequestAccountModal } from '@/components/auth/RequestAccountModal'
import Image from 'next/image'

const errorMessages: Record<string, string> = {
  unauthorized: "This Google account isn't registered in the system. Please use the account your manager provided.",
  auth_failed: "Sign in failed. Please try again.",
  access_denied: "You declined the Google sign-in. Please try again.",
  redirect_uri_mismatch: "OAuth redirect URL not configured. Contact your administrator.",
  account_disabled: "Your account has been disabled. Please contact your administrator.",
}

export default function LoginPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [supportOpen, setSupportOpen] = useState(false)
  const [requestOpen, setRequestOpen] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const errorCode = params.get('error')
    const errorDesc = params.get('error_description')
    if (errorCode) {
      const mapped = errorMessages[errorCode]
      if (mapped) {
        setError(mapped)
      } else if (errorDesc) {
        setError(errorDesc)
      } else {
        setError(`Sign in failed (${errorCode}). Please try again.`)
      }
    }
  }, [])

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/callback`,
          queryParams: { prompt: 'select_account' },
        },
      })
      if (error) setError(error.message)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480,
            height: 480,
            background: 'radial-gradient(circle, rgba(30,105,145,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 320,
            height: 320,
            transform: 'translate(120px, -80px)',
            background: 'radial-gradient(circle, rgba(245,155,25,0.15) 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm animate-in fade-in-0 zoom-in-95 rounded-2xl border bg-card/80 px-8 py-10 shadow-2xl backdrop-blur-xl duration-300">
        <div className="fade-in-stagger flex flex-col items-center">
          <div className="relative mb-6 flex h-32 w-32 items-center justify-center">
            <Image
              src="/vaalogo.svg"
              alt="VAA Logo"
              width={128}
              height={128}
              className="drop-shadow-lg"
            />
          </div>

          <p
            className="text-center text-lg font-semibold tracking-tight"
            style={{ fontFamily: 'var(--font-montserrat)', color: '#176E9C' }}
          >
            Our Experts . Your Growth
          </p>
          <p className="mt-1.5 text-center text-xs text-muted-foreground">
            Sign in to continue
          </p>

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="mt-6 h-9 w-full rounded-lg border-0 bg-[#1a73e8] text-sm font-medium text-white hover:bg-[#1557b0]"
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? 'Redirecting...' : 'Sign in with Google'}
          </Button>

          {error && (
            <div className="mt-4 w-full rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              <div className="flex gap-2">
                <svg className="h-5 w-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <div>
                  <p className="font-medium">Sign in failed</p>
                  <p className="mt-1">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="ml-auto shrink-0 text-destructive/70 hover:text-destructive">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="my-5 h-px w-full bg-border" />

          <div className="flex flex-col items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Trouble logging in?
            </button>
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Don't have an account? <span className="font-medium text-foreground">Request one</span>
            </button>
          </div>

          <p className="mt-5 text-center text-[11px] text-muted-foreground/70">
            Account credentials are provided by your manager.
          </p>
        </div>
      </div>

      <SupportRequestModal open={supportOpen} onOpenChange={setSupportOpen} />
      <RequestAccountModal open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  )
}
