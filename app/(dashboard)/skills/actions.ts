'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { requireAdminMutator } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

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
  revalidatePath(`/admin/departments`)
  revalidatePath('/skills')
  revalidateTag(CACHE_TAGS.departments, 'default')
  revalidateTag(CACHE_TAGS.skills, 'default')
}