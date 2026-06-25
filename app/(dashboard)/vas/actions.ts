'use server'

import { prisma } from '@/lib/prisma'
import { createServerSupabase } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function signupVA(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string
  const department = formData.get('department') as string
  const phone = (formData.get('phone') as string) || null
  const hourlyRate = formData.get('hourlyRate')
    ? parseFloat(formData.get('hourlyRate') as string)
    : null

  const supabase = await createServerSupabase()
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()
  if (!authUser) throw new Error('Not authenticated')

  const manager = await prisma.user.findUnique({ where: { email: authUser.email! } })
  if (!manager || manager.role !== 'MANAGER') throw new Error('Unauthorized')

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: 'VA', department },
  })

  if (error) throw new Error(error.message)

  await prisma.user.create({
    data: {
      id: data.user.id,
      email,
      name,
      role: 'VA',
      department,
      vaProfile: {
        create: { phone, hourlyRate },
      },
    },
  })

  revalidatePath('/vas')
  redirect('/vas')
}

export async function updateVA(vaId: string, formData: FormData) {
  const name = formData.get('name') as string
  const department = formData.get('department') as string
  const phone = (formData.get('phone') as string) || null
  const hourlyRate = formData.get('hourlyRate')
    ? parseFloat(formData.get('hourlyRate') as string)
    : null
  const notes = (formData.get('notes') as string) || null

  const profile = await prisma.vAProfile.findUnique({
    where: { id: vaId },
    include: { user: true },
  })
  if (!profile) throw new Error('VA not found')

  await prisma.user.update({
    where: { id: profile.userId },
    data: {
      name,
      department,
      vaProfile: { update: { phone, hourlyRate, notes } },
    },
  })

  revalidatePath('/vas')
}
