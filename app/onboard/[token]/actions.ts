'use server'

// Server Actions in this file are intentionally public — reachable by a VA
// who has no Supabase session yet. Each one authenticates via the one-time
// onboarding token instead of requireAuth()/requireRole(); see the
// PUBLIC_TOKEN_ACTIONS exception in scripts/check-action-auth.ts.

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { logAudit } from '@/lib/audit'
import { normalizeWhatsApp, normalizeGcash } from '@/lib/phone'

const PROFILE_FIELDS = [
  'middleName', 'extName', // routed to User below, not UserProfile
  'whatsappNumber', 'gcashNumber', 'phone',
  'barangay', 'cityMunicipality', 'province', 'houseNumber', 'zipCode', 'landmark', 'address',
  'regionCode', 'provinceCode', 'cityCode', 'barangayCode',
  'facebookUrl', 'facebookName', 'linkedinUrl',
  'passportNumber', 'philhealthNumber',
] as const

// AddressFields (components/vas/AddressFields.tsx) submits the PSGC cascade
// under an "address." prefix (namePrefix="address"), not as bare field names.
const ADDRESS_CASCADE_FIELDS = new Set([
  'barangay', 'cityMunicipality', 'province', 'regionCode', 'provinceCode', 'cityCode', 'barangayCode',
])

export async function completeOnboarding(token: string, formData: FormData) {
  const invite = await prisma.vAOnboardingInvite.findUnique({ where: { token } })
  if (!invite) throw new Error('This onboarding link is invalid.')
  if (invite.completedAt) throw new Error('This onboarding link has already been used.')
  if (invite.expiresAt < new Date()) throw new Error('This onboarding link has expired — contact HR for a new one.')

  const data: Record<string, unknown> = {}
  const userData: Record<string, unknown> = {}

  for (const field of PROFILE_FIELDS) {
    const formKey = ADDRESS_CASCADE_FIELDS.has(field) ? `address.${field}` : field
    const value = formData.get(formKey)
    if (value === null) continue
    if (field === 'whatsappNumber') data[field] = value ? normalizeWhatsApp(value as string) : null
    else if (field === 'gcashNumber') data[field] = value ? normalizeGcash(value as string) : null
    else data[field] = value || null
  }
  if ('middleName' in data) { userData.middleName = data.middleName; delete data.middleName }
  if ('extName' in data) { userData.extName = data.extName; delete data.extName }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(userData).length > 0) {
      await tx.user.update({ where: { id: invite.userId }, data: userData })
    }
    await tx.userProfile.upsert({
      where: { userId: invite.userId },
      create: { userId: invite.userId, ...data },
      update: data,
    })
    await tx.vAOnboardingInvite.update({ where: { id: invite.id }, data: { completedAt: new Date() } })
  })

  await logAudit({
    actorId: invite.userId,
    action: 'UPDATE',
    entityType: 'UserProfile',
    entityId: invite.userId,
    after: { ...userData, ...data },
    metadata: { viaForm: 'onboarding-self-service' },
  })

  const va = await prisma.vAProfile.findUnique({ where: { userId: invite.userId }, select: { id: true } })
  if (va) revalidatePath(`/vas/${va.id}`)
  revalidatePath('/vas')
  revalidateTag(CACHE_TAGS.users, 'default')
  revalidateTag(CACHE_TAGS.vas, 'default')

  redirect(`/onboard/${token}/done`)
}
