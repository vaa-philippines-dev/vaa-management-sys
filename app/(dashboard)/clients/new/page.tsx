import { prisma } from '@/lib/prisma'
import { getCurrentUser, CLIENT_MUTATOR_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { ClientForm } from '@/components/clients/ClientForm'

export default async function NewClientPage() {
  const user = await getCurrentUser()
  if (!user || !CLIENT_MUTATOR_ROLES.includes(user.systemRole)) {
    redirect('/dashboard')
  }

  const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Client</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add a new client and their required skills
        </p>
      </div>
      <ClientForm skills={skills.map((s) => s.name)} managerId={user?.id} />
    </div>
  )
}