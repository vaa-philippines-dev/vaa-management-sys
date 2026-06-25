import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'

export async function getCurrentUser() {
  const supabase = await createServerSupabase()
  if (!supabase) return null

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const dbUser = await prisma.user.findUnique({
    where: { email: user.email! },
    include: { vaProfile: true },
  })
  return dbUser
}

export async function requireManager() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'MANAGER') throw new Error('Unauthorized')
  return user
}

export async function requireVA() {
  const user = await getCurrentUser()
  if (!user || user.role !== 'VA') throw new Error('Unauthorized')
  return user
}

export async function requireAuth() {
  const user = await getCurrentUser()
  if (!user) throw new Error('Unauthorized')
  return user
}
