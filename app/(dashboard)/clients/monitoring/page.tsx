import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate, getManagedDepartmentIds, getPrimaryDepartment } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import { Building2 } from 'lucide-react'
import { ClientCard } from '@/components/clients/ClientCard'

export default async function ClientsMonitoringPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isAdmin = canMutate(user)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  let scopedDeptIds: string[] = []
  if (!isAdmin) {
    if (isVA) {
      const primaryDept = getPrimaryDepartment(user)
      if (primaryDept) scopedDeptIds = [primaryDept.id]
    } else {
      scopedDeptIds = getManagedDepartmentIds(user)
    }
  }

  // v1 scoping is department-only: Client.requiredSkills is a free-text String[],
  // not a relation, so cross-referencing it against DepartmentSkill/Skill names is
  // left as a future stretch rather than built here.
  const clients = await cached(
    `clients:monitoring:${isAdmin ? 'all' : scopedDeptIds.join(',')}`,
    [CACHE_TAGS.clients],
    60,
    () =>
      prisma.client.findMany({
        where: isAdmin ? undefined : { departmentId: { in: scopedDeptIds } },
        include: {
          assignments: { include: { vaProfile: { include: { user: true } } } },
        },
        orderBy: { createdAt: 'desc' },
      })
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Clients Monitoring</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Clients within your department{isAdmin ? 's' : ''}
        </p>
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No clients found for your department.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 fade-in-stagger">
          {clients.map((c) => (
            <ClientCard key={c.id} c={c} />
          ))}
        </div>
      )}
    </div>
  )
}
