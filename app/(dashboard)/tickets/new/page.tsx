import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getViewScope, clientScopeWhere } from '@/lib/scope'
import { NewTicketForm } from '@/components/tickets/NewTicketForm'

export default async function NewTicketPage() {
  // Without this guard the page's only protection was proxy.ts, whose
  // getSession() check trusts the session cookie's shape rather than verifying
  // it — so a stale or forged cookie reached these queries and disclosed every
  // active client and department name.
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const scope = user.userType === 'VIRTUAL_ASSISTANT' ? null : await getViewScope(user)
  const [departments, clients] = await Promise.all([
    prisma.department.findMany({
      where: { status: 'ACTIVE', parentId: { not: null } },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      // Staff pick only from their own departments' clients; admins/HR see all.
      // A VA picks only from clients they actually work (or worked) for.
      where: {
        isActive: true,
        ...(user.userType === 'VIRTUAL_ASSISTANT'
          ? { assignments: { some: { vaProfile: { userId: user.id } } } }
          : clientScopeWhere(scope)),
      },
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
