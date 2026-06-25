import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { WorkLogForm } from '@/components/work-logs/WorkLogForm'

export default async function NewWorkLogPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const { clientId: assignmentId } = await searchParams
  const user = await getCurrentUser()

  const where: Record<string, unknown> = { status: 'ACTIVE' }
  if (user?.role === 'VA') {
    where.vaProfileId = user.vaProfile?.id
  }

  const assignments = await prisma.assignment.findMany({
    where: where as any,
    include: {
      client: true,
      vaProfile: { include: { user: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Log Hours</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Record hours worked for an assignment
        </p>
      </div>
      <WorkLogForm
        assignments={assignments.map((a) => ({
          id: a.id,
          label: user?.role === 'VA' ? a.client.name : `${a.client.name} — ${a.vaProfile.user.name || a.vaProfile.user.email}`,
        }))}
        defaultAssignmentId={assignmentId}
      />
    </div>
  )
}