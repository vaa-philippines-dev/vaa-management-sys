import { prisma } from '@/lib/prisma'
import { getCurrentUser, getManagedDepartmentIds, getPrimaryDepartment } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { isTeamAffiliated } from '@/lib/teams'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Building2 } from 'lucide-react'
import { ClientCard } from '@/components/clients/ClientCard'

const DEPARTMENT_SCOPED_ROLES = ['DEPT_MANAGER', 'OPERATIONS_MANAGER']
const UNRESTRICTED_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR']

// Department-category audience (Dept/Ops Manager, HR, admins, team-affiliated VAs)
// see clients scoped to their department, same as the former standalone Clients
// Monitoring page. Everyone else (e.g. plain STAFF) keeps the original "clients
// I personally manage" view.
async function resolveClientsWhere(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!user) return undefined
  if (UNRESTRICTED_ROLES.includes(user.systemRole)) return undefined

  if (DEPARTMENT_SCOPED_ROLES.includes(user.systemRole)) {
    return { departmentId: { in: getManagedDepartmentIds(user) } }
  }

  if (user.userType === 'VIRTUAL_ASSISTANT' && (await isTeamAffiliated(user.id))) {
    const primaryDept = getPrimaryDepartment(user)
    return { departmentId: { in: primaryDept ? [primaryDept.id] : [] } }
  }

  return user.systemRole === 'STAFF' ? { managerId: user.id } : undefined
}

export default async function ClientsPage() {
  const user = await getCurrentUser()
  const isDevMode = !process.env.NEXT_PUBLIC_SUPABASE_URL

  const where = await resolveClientsWhere(user)
  const cacheKey = user ? `clients:list:${user.id}:${JSON.stringify(where)}` : 'clients:list'

  const clients = await cached(cacheKey, [CACHE_TAGS.clients], 60, () =>
    prisma.client.findMany({
      where,
      include: {
        assignments: { include: { vaProfile: { include: { user: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Clients</h2>
          <p className="text-sm text-muted-foreground mt-1">
            E-commerce sellers and brands receiving VA support
          </p>
        </div>
        {isDevMode && (
          <Link href="/clients/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Client
            </Button>
          </Link>
        )}
      </div>

      {clients.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No clients yet.</p>
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
