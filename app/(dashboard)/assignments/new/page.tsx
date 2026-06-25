import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssignmentForm } from '@/components/assignments/AssignmentForm'

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { clientId } = await searchParams

  const [clients, vas] = await Promise.all([
    prisma.client.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } }),
    prisma.vAProfile.findMany({
      where: { isActive: true },
      include: { user: true, skills: true },
      orderBy: { user: { name: 'asc' } },
    }),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Assignment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Match a VA to a client with agreed hours
        </p>
      </div>
      <AssignmentForm
        clients={clients.map((c) => ({
          id: c.id,
          name: c.name,
          requiredSkills: c.requiredSkills,
        }))}
        vas={vas.map((v) => ({
          id: v.id,
          name: v.user.name || v.user.email,
          skills: v.skills.map((s) => s.name),
        }))}
        defaultClientId={clientId}
      />
    </div>
  )
}