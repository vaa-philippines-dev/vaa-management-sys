'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'

export async function createClient(formData: FormData) {
  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const notes = (formData.get('notes') as string) || null
  const managerId = (formData.get('managerId') as string) || null
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

  const client = await prisma.client.create({
    data: {
      name,
      contactName,
      contactEmail,
      platform: platform as any,
      industry,
      notes,
      managerId,
      requiredSkills: skills,
    },
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  redirect(`/clients/${client.id}`)
}

export async function updateClient(id: string, formData: FormData) {
  const name = formData.get('name') as string
  const contactName = (formData.get('contactName') as string) || null
  const contactEmail = (formData.get('contactEmail') as string) || null
  const platform = (formData.get('platform') as string) || 'MULTI'
  const industry = (formData.get('industry') as string) || null
  const notes = (formData.get('notes') as string) || null
  const isActive = formData.get('isActive') === 'on'
  const skills = (formData.getAll('requiredSkills') as string[]).filter(Boolean)

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
      requiredSkills: skills,
    },
  })

  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  revalidatePath(`/clients/${id}`)
  revalidateTag(CACHE_TAGS.clients, 'default')
}

export async function deleteClient(id: string) {
  await prisma.client.delete({ where: { id } })
  revalidatePath('/clients')
  revalidateTag(CACHE_TAGS.clients, 'default')
  redirect('/clients')
}