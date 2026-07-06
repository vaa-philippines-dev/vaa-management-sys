'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { isServiceLevel, DepartmentValidationError } from '@/lib/departments'
import { requireRole, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function createClient(formData: FormData) {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const notes = (formData.get('notes') as string) || null
  const managerId = (formData.get('managerId') as string) || null
  const departmentId = (formData.get('departmentId') as string) || null
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

  if (departmentId) {
    const ok = await isServiceLevel(departmentId)
    if (!ok) {
      throw new DepartmentValidationError([{ field: 'departmentId', message: 'Clients can only be assigned to Service-level departments' }])
    }
  }

  const client = await prisma.client.create({
    data: {
      name,
      contactName,
      contactEmail,
      platform: platform as any,
      industry,
      notes,
      managerId,
      departmentId: departmentId || null,
      requiredSkills: skills,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Client',
    entityId: client.id,
    after: { name, contactName, contactEmail, platform, industry, managerId, departmentId },
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  redirect(`/clients/${client.id}`)
}

export async function updateClient(id: string, formData: FormData) {
  const actor = await requireRole(...CLIENT_MUTATOR_ROLES)

  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const notes = (formData.get('notes') as string) || null
  const isActive = formData.get('isActive') === 'on'
  const departmentId = (formData.get('departmentId') as string) || null
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

  if (departmentId) {
    const ok = await isServiceLevel(departmentId)
    if (!ok) {
      throw new DepartmentValidationError([{ field: 'departmentId', message: 'Clients can only be assigned to Service-level departments' }])
    }
  }

  const before = await prisma.client.findUnique({
    where: { id },
    select: { name: true, contactName: true, contactEmail: true, platform: true, industry: true, isActive: true, departmentId: true },
  })

  await prisma.client.update({
    where: { id },
    data: {
      name,
      contactName,
      contactEmail,
      platform: platform as any,
      industry,
      notes,
      isActive,
      departmentId: departmentId || null,
      requiredSkills: skills,
    },
  })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Client',
    entityId: id,
    before: before ? { ...before } : undefined,
    after: { name, contactName, contactEmail, platform, industry, isActive, departmentId },
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  revalidatePath(`/clients/${id}`)
  revalidateTag(CACHE_TAGS.clients, 'default')
}

export async function deleteClient(id: string) {
  const actor = await requireRole('SUPER_ADMIN', 'SYSTEM_ADMIN')

  const before = await prisma.client.findUnique({ where: { id }, select: { name: true } })

  await prisma.client.delete({ where: { id } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'Client',
    entityId: id,
    before: before ? { ...before } : undefined,
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  redirect('/clients')
}