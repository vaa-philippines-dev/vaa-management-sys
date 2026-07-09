import { prisma } from '@/lib/prisma'
import { NewTicketForm } from '@/components/tickets/NewTicketForm'

export default async function NewTicketPage() {
  const [departments, clients] = await Promise.all([
    prisma.department.findMany({
      where: { status: 'ACTIVE', parentId: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Report a Problem</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a screenshot and we&apos;ll draft the ticket for you, or fill it in yourself.
        </p>
      </div>
      <NewTicketForm departments={departments} clients={clients} />
    </div>
  )
}
