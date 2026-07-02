'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireAdminMutator, canMutate } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

const MAX_NAME = 100
const MAX_SHORT = 50
const MAX_ACRONYM = 6
const ACRONYM_REGEX = /^[A-Z0-9 ]{2,6}$/
const CATEGORIES = ['AMAZON', 'WALMART', 'TIKTOK_SHOP', 'SHOPIFY', 'GENERAL']

export async function createSkill(formData: FormData) {
  await requireAdminMutator()
  const name = ((formData.get('name') as string) ?? '').trim()
  const shortName = ((formData.get('shortName') as string) ?? '').trim() || null
  const acronym = ((formData.get('acronym') as string) ?? '').trim().toUpperCase() || null
  const category = (formData.get('category') as string) || 'GENERAL'
  const jobDescription = ((formData.get('jobDescription') as string) ?? '').trim() || null
  const attachmentUrl = ((formData.get('attachmentUrl') as string) ?? '').trim() || null

  if (!name) return { error: 'Name is required' }
  if (name.length > MAX_NAME) return { error: `Name must not exceed ${MAX_NAME} characters` }
  if (shortName && shortName.length > MAX_SHORT) return { error: `Short name must not exceed ${MAX_SHORT} characters` }
  if (acronym) {
    if (acronym.length > MAX_ACRONYM) return { error: `Acronym must be at most ${MAX_ACRONYM} characters` }
    if (!ACRONYM_REGEX.test(acronym)) return { error: 'Acronym must be 2-6 uppercase letters' }
  }
  if (!CATEGORIES.includes(category)) return { error: 'Invalid category' }

  try {
    await prisma.skill.upsert({
      where: { name },
      update: { shortName, acronym, category: category as any, jobDescription, attachmentUrl },
      create: { name, shortName, acronym, category: category as any, jobDescription, attachmentUrl },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return { error: 'Acronym already in use' }
    }
    throw e
  }
  revalidatePath('/skills')
  revalidatePath('/admin/departments')
  revalidateTag(CACHE_TAGS.skills, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
  return { success: true }
}

export async function updateSkill(id: string, formData: FormData) {
  await requireAdminMutator()
  const name = ((formData.get('name') as string) ?? '').trim()
  const shortName = ((formData.get('shortName') as string) ?? '').trim() || null
  const acronym = ((formData.get('acronym') as string) ?? '').trim().toUpperCase() || null
  const category = (formData.get('category') as string) || 'GENERAL'
  const jobDescription = ((formData.get('jobDescription') as string) ?? '').trim() || null
  const attachmentUrl = ((formData.get('attachmentUrl') as string) ?? '').trim() || null
  const isActive = formData.get('isActive') === 'on'

  if (!name) return { error: 'Name is required' }
  if (acronym) {
    if (acronym.length > MAX_ACRONYM) return { error: `Acronym must be at most ${MAX_ACRONYM} characters` }
    if (!ACRONYM_REGEX.test(acronym)) return { error: 'Acronym must be 2-6 uppercase letters' }
  }

  try {
    await prisma.skill.update({
      where: { id },
      data: { name, shortName, acronym, category: category as any, jobDescription, attachmentUrl, isActive },
    })
  } catch (e: any) {
    if (e?.code === 'P2002') {
      return { error: 'Acronym already in use' }
    }
    throw e
  }
  revalidatePath('/skills')
  revalidatePath('/admin/departments')
  revalidateTag(CACHE_TAGS.skills, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
  return { success: true }
}

export async function deleteSkill(id: string) {
  await requireAdminMutator()
  await prisma.skill.delete({ where: { id } })
  revalidatePath('/skills')
  revalidatePath('/admin/departments')
  revalidateTag(CACHE_TAGS.skills, 'default')
  revalidateTag(CACHE_TAGS.departments, 'default')
}

export async function setDepartmentSkills(departmentId: string, skillIds: string[]) {
  const admin = await requireAdminMutator()

  const before = await prisma.departmentSkill.findMany({
    where: { departmentId },
    select: { skillId: true },
  })
  const beforeIds = new Set(before.map((b) => b.skillId))
  const newIds = new Set(skillIds)

  const toAdd = [...newIds].filter((id) => !beforeIds.has(id))
  const toRemove = [...beforeIds].filter((id) => !newIds.has(id))

  await prisma.$transaction(async (tx) => {
    if (toRemove.length > 0) {
      await tx.departmentSkill.deleteMany({
        where: { departmentId, skillId: { in: toRemove } },
      })
    }
    if (toAdd.length > 0) {
      await tx.departmentSkill.createMany({
        data: toAdd.map((skillId) => ({ departmentId, skillId })),
      })
    }
  })

  await logAudit({
    actorId: admin.id,
    action: 'UPDATE',
    entityType: 'Department',
    entityId: departmentId,
    before: { skillIds: [...beforeIds] },
    after: { skillIds: [...newIds] },
    metadata: { operation: 'setDepartmentSkills', added: toAdd, removed: toRemove },
    departmentId,
  })

  revalidatePath('/admin/departments')
  revalidatePath('/skills')
  revalidateTag(CACHE_TAGS.departments, 'default')
  revalidateTag(CACHE_TAGS.skills, 'default')
}