'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAuth, VIEW_AS_COOKIE, VIEW_AS_DEPARTMENT_COOKIE, VIEW_AS_ROLES, type ViewAsRole } from '@/lib/auth'

// departmentId is only meaningful (and only honored) for the DEPT_MANAGER role —
// see VIEW_AS_DEPARTMENT_COOKIE in lib/auth.ts for why it's needed at all.
export async function setViewAsRole(role: ViewAsRole, departmentId?: string) {
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

  if (role === 'DEPT_MANAGER' && departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: departmentId, level: 'SERVICE', status: 'ACTIVE' },
      select: { id: true },
    })
    if (!department) throw new Error('Invalid department')

    cookieStore.set(VIEW_AS_DEPARTMENT_COOKIE, department.id, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    })
  } else {
    // Switching to a different role (or Dept Manager with no department chosen
    // yet) — drop any stale department selection so it can't bleed into a
    // future Dept Manager simulation.
    cookieStore.delete(VIEW_AS_DEPARTMENT_COOKIE)
  }

  revalidatePath('/', 'layout')
}

export async function clearViewAsRole() {
  await requireAuth()
  const cookieStore = await cookies()
  cookieStore.delete(VIEW_AS_COOKIE)
  cookieStore.delete(VIEW_AS_DEPARTMENT_COOKIE)
  revalidatePath('/', 'layout')
}
