import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import {
  getConcernAccess,
  getConcernRows,
  getConcernVaOptions,
  canOpenConcerns,
  canRaiseConcerns,
} from '@/lib/va-concerns'
import { ConcernsBoard } from '@/components/va-concerns/ConcernsBoard'
import { StatCard } from '@/components/ui/stat-card'
import { MessageSquareWarning, CircleDot, Search, ArrowUpRight, CheckCircle2 } from 'lucide-react'

// The DMF sheet's "VA Concerns" tab: concerns about a VA, raised by their
// Team Leader and handed up to the department's managers and on to HR,
// Client Experience, Business Process or Accounting. See lib/va-concerns.ts
// for who sees and edits which concerns.
export default async function VaConcernsPage({ searchParams }: { searchParams: Promise<{ concern?: string }> }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const access = await getConcernAccess(user)
  if (!canOpenConcerns(access)) redirect('/dashboard')

  const [concerns, vaOptions] = await Promise.all([getConcernRows(access), getConcernVaOptions(access)])
  const { concern: concernId } = await searchParams

  const count = (status: string) => concerns.filter((c) => c.status === status).length
  const departmentCount = new Set(concerns.map((c) => c.departmentId)).size

  return (
    <div data-wide-page className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <MessageSquareWarning className="h-6 w-6" />
          VA Concerns
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Concerns about a VA, from the Team Leader&apos;s first action through to escalation
          {access.viewAll ? ' across every department' : ''}.
        </p>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 fade-in-stagger">
        <StatCard icon={CircleDot} label="Pending" value={count('PENDING')} />
        <StatCard icon={Search} label="Under review" value={count('UNDER_REVIEW')} />
        <StatCard icon={ArrowUpRight} label="Escalated" value={count('ESCALATED')} />
        <StatCard icon={CheckCircle2} label="Resolved" value={count('RESOLVED')} />
      </div>

      <ConcernsBoard
        concerns={concerns}
        vaOptions={vaOptions}
        canRaise={canRaiseConcerns(access)}
        showDepartment={access.viewAll || access.managedDepartmentIds.length > 1 || departmentCount > 1}
        initialConcernId={concernId ?? null}
      />
    </div>
  )
}
