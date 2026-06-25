'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createVA(formData: FormData) {
  const email = formData.get('email') as string
  const name = (formData.get('name') as string) || null
  const phone = (formData.get('phone') as string) || null
  const hourlyRate = formData.get('hourlyRate') as string
  const notes = (formData.get('notes') as string) || null
  const skillIds = formData.getAll('skillIds') as string[]

  const user = await prisma.user.create({
    data: {
      email,
      name,
      role: 'VA',
      vaProfile: {
        create: {
          phone,
          hourlyRate: hourlyRate ? Number(hourlyRate) : null,
          notes,
          skills: { connect: skillIds.map((id) => ({ id })) },
        },
      },
    },
    include: { vaProfile: true },
  })

  revalidatePath('/vas')
  redirect(`/vas/${user.vaProfile!.id}`)
}