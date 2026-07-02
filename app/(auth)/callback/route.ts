import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code) {
    console.error('[callback] No code provided')
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      console.error('[callback] exchangeCodeForSession error:', exchangeError.message, exchangeError)
      return NextResponse.redirect(
        `${origin}/login?error=auth_failed&error_description=${encodeURIComponent(exchangeError.message)}`
      )
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user?.email) {
      const dbUser = await prisma.user.findUnique({ where: { email: user.email } })
      if (!dbUser) {
        console.warn('[callback] No Prisma user for email:', user.email)
        const admin = createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
          { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
        )
        await admin.auth.admin.deleteUser(user.id)
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=unauthorized`)
      }

      if (!dbUser.isActive) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=account_disabled`)
      }

      const adminRoles = ['SUPER_ADMIN', 'SYSTEM_ADMIN']
      if (adminRoles.includes(dbUser.systemRole) && next === '/dashboard') {
        const res = NextResponse.redirect(`${origin}/departments`)
        res.cookies.set('vaa_just_logged_in', '1', { path: '/', maxAge: 10, httpOnly: false, sameSite: 'lax' })
        return res
      }
    }
    const res = NextResponse.redirect(`${origin}${next}`)
    res.cookies.set('vaa_just_logged_in', '1', { path: '/', maxAge: 10, httpOnly: false, sameSite: 'lax' })
    return res
  } catch (err: any) {
    console.error('[callback] Unhandled error:', err?.message, err)
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&error_description=${encodeURIComponent(err?.message ?? 'unknown')}`
    )
  }
}
