import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getViewScope } from '@/lib/scope'
import { getVaClientSummary } from '@/lib/va-client-summary'
import { formatDailyHours } from '@/lib/va-client-summary-fields'
import { VaClientSummaryBoard } from '@/components/va-client-summary/VaClientSummaryBoard'
import { StatCard } from '@/components/ui/stat-card'
import { Network, Users, UserX, Briefcase, Clock } from 'lucide-react'

// The DMF sheet's "VA-Client Summary" tab: every VA with their clients, and
// every active client with its VAs. Read-only — both lists come from the
// active assignments, which are edited on the Assignments tab.
export default async function VaClientSummaryPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  // lib/scope.ts: admins/HR/EXECUTIVE everything, DM/OM/Staff their
  // departments, a Team Leader only the people on the teams they lead.
  const scope = await getViewScope(user)
  const { vas, clients } = await getVaClientSummary(scope)

  const departments = new Map<string, string>()
  for (const r of [...vas, ...clients]) departments.set(r.departmentId, r.departmentName)
  const departmentList = [...departments]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const withClient = vas.filter((v) => v.clients.length > 0).length
  const totalHours = clients.reduce((sum, c) => sum + c.totalHours, 0)

  return (
    <div data-wide-page className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Network className="h-6 w-6" />
          VA-Client Summary
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Which clients each VA works for, and which VAs each client has, from the active assignments
          {scope === null ? ' across every department' : ''}.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 fade-in-stagger">
        <StatCard icon={Users} label="VAs with a client" value={withClient} />
        <StatCard icon={UserX} label="VAs with no client" value={vas.length - withClient} />
        <StatCard icon={Briefcase} label="Active clients" value={clients.length} />
        <StatCard icon={Clock} label="Booked hours" value={formatDailyHours(totalHours)} />
      </div>

      <VaClientSummaryBoard vas={vas} clients={clients} departments={departmentList} />
    </div>
  )
}
