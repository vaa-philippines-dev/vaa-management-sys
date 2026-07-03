import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const protectedPaths = ['/clients', '/vas', '/assignments', '/work-logs', '/skills', '/reports', '/dashboard', '/departments', '/admin']
const authPaths = ['/login']

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        )
      },
    },
  })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl
  const isProtected = protectedPaths.some((p) => pathname.startsWith(p))
  const isAuth = authPaths.some((p) => pathname === p) || pathname === '/'

  const justLoggedIn = request.cookies.get('vaa_just_logged_in')

  if (isProtected && !session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isAuth && session) {
    const redirectRes = NextResponse.redirect(new URL('/dashboard', request.url))
    if (justLoggedIn) {
      redirectRes.cookies.set('vaa_just_logged_in', justLoggedIn.value, { path: '/', maxAge: 10, httpOnly: false, sameSite: 'lax' })
    }
    return redirectRes
  }

  if (justLoggedIn) {
    response.cookies.set('vaa_just_logged_in', justLoggedIn.value, { path: '/', maxAge: 10, httpOnly: false, sameSite: 'lax' })
  }

  return response
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
