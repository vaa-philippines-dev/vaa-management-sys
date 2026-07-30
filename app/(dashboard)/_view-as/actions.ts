'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { requireAuth, VIEW_AS_COOKIE, VIEW_AS_ROLES, type ViewAsRole } from '@/lib/auth'

export async function setViewAsRole(role: ViewAsRole) {
  const user = await requireAuth()
  if (!['SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user.realSystemRole)) {
    throw new Error('Forbidden')
  }
  if (!(VIEW_AS_ROLES as readonly string[]).includes(role)) {
    throw new Error('Invalid role')
  }

  const cookieStore = await cookies()
  cookieStore.set(VIEW_AS_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
  })

  revalidatePath('/', 'layout')
}

export async function clearViewAsRole() {
  await requireAuth()
  const cookieStore = await cookies()
  cookieStore.delete(VIEW_AS_COOKIE)
  revalidatePath('/', 'layout')
}
