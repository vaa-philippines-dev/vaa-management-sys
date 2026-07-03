'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
    <div className="flex min-h-screen bg-background">
      <div
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12 text-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #1E6991 0%, #134a63 100%)' }}
      >
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 420,
            height: 420,
            top: '-10%',
            right: '-10%',
            background: 'radial-gradient(circle, rgba(245,155,25,0.35) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 320,
            height: 320,
            bottom: '-10%',
            left: '-10%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
          }}
        />
        <div className="relative z-10 flex flex-col items-center">
          <Image
            src="/vaalogo.svg"
            alt="VAA Philippines Logo"
            width={140}
            height={140}
            className="drop-shadow-2xl mb-8"
          />
          <h1 className="text-3xl font-bold text-white tracking-tight">
            VAA Philippines
          </h1>
          <p className="mt-3 text-lg text-white/80" style={{ fontFamily: 'var(--font-montserrat)' }}>
            Our <span style={{ color: '#F59B19' }}>E</span>xperts . Your Growth
          </p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-8">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/vaalogo.svg"
              alt="VAA Philippines Logo"
              width={96}
              height={96}
              className="mb-6 lg:hidden"
            />
            <h2 className="text-3xl font-bold tracking-tight text-foreground">
              Sign in to your VAA account
            </h2>
            <p className="mt-2 text-base text-muted-foreground">
              Use your provided Google account
            </p>
          </div>

          <Button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full h-12 bg-[#1a73e8] hover:bg-[#1557b0] text-white border-0"
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
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
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

          <p className="text-center text-sm text-muted-foreground">
            Note: Account credentials are provided by your manager.
          </p>
        </div>
      </div>
    </div>
  )
}