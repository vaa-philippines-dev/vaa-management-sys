import { prisma } from '@/lib/prisma'
import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssignmentForm } from '@/components/assignments/AssignmentForm'

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !ASSIGNMENT_MUTATOR_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { clientId } = await searchParams

  const [clients, vas] = await Promise.all([
    prisma.client.findMany({ where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
    prisma.vAProfile.findMany({
      where: { status: 'ACTIVE' },
      include: { user: true, vaSkills: { include: { skill: true } } },
      orderBy: { user: { firstName: 'asc' } },
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
          name: v.user.firstName || v.user.email,
          skills: v.vaSkills.map((s) => s.skill.name),
        }))}
        defaultClientId={clientId}
      />
    </div>
  )
}