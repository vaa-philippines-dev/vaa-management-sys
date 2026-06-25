import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import { requireManager } from '@/lib/auth'
import { VAForm } from '@/components/vas/VAForm'
import { updateVA } from '../actions'

export default async function VAEditPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  await requireManager()

  const va = await prisma.vAProfile.findUnique({
    where: { id },
    include: { user: true, tasks: { orderBy: { createdAt: 'desc' }, take: 10 } },
  })
  if (!va) notFound()

  const serializedVa = {
    id: va.id,
    phone: va.phone,
    hourlyRate: va.hourlyRate ? Number(va.hourlyRate) : null,
    notes: va.notes,
    isActive: va.isActive,
    user: va.user,
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h2 className="text-2xl font-semibold">Edit VA</h2>
      <VAForm action={updateVA.bind(null, va.id)} va={serializedVa} />
    </div>
  )
}
