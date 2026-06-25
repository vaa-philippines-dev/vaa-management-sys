'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

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
}

export async function deleteSkill(id: string) {
  await prisma.skill.delete({ where: { id } })
  revalidatePath('/skills')
}