'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { SupportRequestModal } from '@/components/auth/SupportRequestModal'
import { RequestAccountModal } from '@/components/auth/RequestAccountModal'
import Image from 'next/image'
import { cn } from '@/lib/utils'

const errorMessages: Record<string, string> = {
  unauthorized: "This Google account isn't registered in the system. Please use the account your manager provided.",
  auth_failed: "Sign in failed. Please try again.",
  access_denied: "You declined the Google sign-in. Please try again.",
  redirect_uri_mismatch: "OAuth redirect URL not configured. Contact your administrator.",
  account_disabled: "Your account has been disabled. Please contact your administrator.",
}

export function LoginForm({ className }: { className?: string }) {
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
    <div
      className={cn(
        'relative w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-950 px-8 py-10 shadow-2xl',
        className
      )}
    >
      <div className="fade-in-stagger flex flex-col items-center">
        <Image
          src="/vaa-logo-white.png"
          alt="VAA Philippines"
          width={350}
          height={134}
          className="h-auto w-28"
          priority
        />

        <p
          className="mt-4 mb-10 whitespace-nowrap text-center font-semibold leading-none tracking-[0.10em] text-white"
          style={{
            fontFamily: 'var(--font-montserrat)',
            fontSize: 'clamp(0.2rem, 4.0vw, 0.8rem)',
          }}
        >
          Our <span style={{ color: '#9CA3AF' }}>E</span>xperts . Your Growth
        </p>
        <p className="mt-1 text-center text-sm font-semibold uppercase tracking-wide text-white">
          Staff & VA Management Portal
        </p>
        <p className="mt-1.5 text-center text-xs text-white/50">
          Continue with your VAA Philippines account.
        </p>

        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="mt-6 h-9 w-full rounded-lg border border-black/10 bg-white text-sm font-medium text-black hover:bg-neutral-100"
        >
          <svg className="mr-2 h-4 w-4" viewBox="0 0 48 48">
            <path
              fill="#FFC107"
              d="M43.611,20.083H42V20H24v8h11.303c-1.649,4.657-6.08,8-11.303,8c-6.627,0-12-5.373-12-12
              c0-6.627,5.373-12,12-12c3.059,0,5.842,1.154,7.961,3.039l5.657-5.657C34.046,6.053,29.268,4,24,4C12.955,4,4,12.955,4,24
              c0,11.045,8.955,20,20,20c11.045,0,20-8.955,20-20C44,22.659,43.862,21.35,43.611,20.083z"
            />
            <path
              fill="#FF3D00"
              d="M6.306,14.691l6.571,4.819C14.655,15.108,18.961,12,24,12c3.059,0,5.842,1.154,7.961,3.039
              l5.657-5.657C34.046,6.053,29.268,4,24,4C16.318,4,9.656,8.337,6.306,14.691z"
            />
            <path
              fill="#4CAF50"
              d="M24,44c5.166,0,9.86-1.977,13.409-5.192l-6.19-5.238C29.211,35.091,26.715,36,24,36
              c-5.202,0-9.619-3.317-11.283-7.946l-6.522,5.025C9.505,39.556,16.227,44,24,44z"
            />
            <path
              fill="#1976D2"
              d="M43.611,20.083H42V20H24v8h11.303c-0.792,2.237-2.231,4.166-4.087,5.571
              c0.001-0.001,0.002-0.001,0.003-0.002l6.19,5.238C36.971,39.205,44,34,44,24C44,22.659,43.862,21.35,43.611,20.083z"
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

        <div className="my-5 h-px w-full bg-white/10" />

        <div className="flex flex-col items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setSupportOpen(true)}
            className="text-white/50 underline-offset-4 hover:text-white hover:underline"
          >
            Trouble logging in?
          </button>
          <button
            type="button"
            onClick={() => setRequestOpen(true)}
            className="text-white/50 underline-offset-4 hover:text-white hover:underline"
          >
            Don't have an account? <span className="font-medium text-white">Request one</span>
          </button>
        </div>

        <p className="mt-5 text-center text-[11px] text-white/30">
          Account credentials are provided by your manager.
        </p>
      </div>

      <SupportRequestModal open={supportOpen} onOpenChange={setSupportOpen} />
      <RequestAccountModal open={requestOpen} onOpenChange={setRequestOpen} />
    </div>
  )
}
