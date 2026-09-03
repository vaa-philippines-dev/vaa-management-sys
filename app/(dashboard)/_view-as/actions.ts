'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import {
  requireAuth,
  VIEW_AS_COOKIE,
  VIEW_AS_DEPARTMENT_COOKIE,
  VIEW_AS_USER_COOKIE,
  VIEW_AS_ROLES,
  VIEW_AS_GRANTOR_ROLES,
  type ViewAsRole,
} from '@/lib/auth'

// departmentId is only meaningful (and only honored) for the DEPT_MANAGER role —
// see VIEW_AS_DEPARTMENT_COOKIE in lib/auth.ts for why it's needed at all.
export async function setViewAsRole(role: ViewAsRole, departmentId?: string) {
  const user = await requireAuth()
  if (!(VIEW_AS_GRANTOR_ROLES as readonly string[]).includes(user.realSystemRole)) {
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
  // A bare role pick is always the generic role-only simulation, not a specific
  // account — drop any leftover setViewAsUser() selection so it can't bleed in.
  cookieStore.delete(VIEW_AS_USER_COOKIE)

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

// Narrows "view as <role>" to one specific real account of that role — see
// VIEW_AS_USER_COOKIE in lib/auth.ts. Unlike the generic role simulation, this
// makes writes (e.g. submitting a leave request) genuinely owned by that
// person, including any real emails/notifications their flow triggers. The
// role is derived from the target account itself, not client-supplied.
export async function setViewAsUser(userId: string) {
  const user = await requireAuth()
  if (!(VIEW_AS_GRANTOR_ROLES as readonly string[]).includes(user.realSystemRole)) {
    throw new Error('Forbidden')
  }

  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, systemRole: true },
  })
  if (!target || !(VIEW_AS_ROLES as readonly string[]).includes(target.systemRole)) {
    throw new Error('Invalid account')
  }

  const cookieStore = await cookies()
  cookieStore.set(VIEW_AS_COOKIE, target.systemRole, { httpOnly: true, sameSite: 'lax', path: '/' })
  cookieStore.set(VIEW_AS_USER_COOKIE, target.id, { httpOnly: true, sameSite: 'lax', path: '/' })
  cookieStore.delete(VIEW_AS_DEPARTMENT_COOKIE)

  revalidatePath('/', 'layout')
}

export async function clearViewAsRole() {
  await requireAuth()
  const cookieStore = await cookies()
  cookieStore.delete(VIEW_AS_COOKIE)
  cookieStore.delete(VIEW_AS_DEPARTMENT_COOKIE)
  cookieStore.delete(VIEW_AS_USER_COOKIE)
  revalidatePath('/', 'layout')
}
