import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { ClientForm } from '@/components/clients/ClientForm'

export default async function NewClientPage() {
  const user = await getCurrentUser()
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