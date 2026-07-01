'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'

export async function createSkill(formData: FormData) {
  const name = (formData.get('name') as string).trim()
  const category = (formData.get('category') as string) || 'GENERAL'
  if (!name) return
  await prisma.skill.upsert({
    where: { name },
    update: { category: category as any },
    create: { name, category: category as any },
  })
  revalidatePath('/skills')
  revalidateTag(CACHE_TAGS.skills, 'default')
}

export async function deleteSkill(id: string) {
  await prisma.skill.delete({ where: { id } })
  revalidatePath('/skills')
  revalidateTag(CACHE_TAGS.skills, 'default')
}