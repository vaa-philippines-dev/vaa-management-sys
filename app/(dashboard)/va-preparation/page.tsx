import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { getViewScope, scopeDepartmentIds, userScopeWhere, vaProfileScopeWhere } from '@/lib/scope'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPreparations } from '@/lib/va-preparation'
import { teamLeaderUserWhere } from '@/lib/teams'
import { PreparationBoard } from '@/components/va-preparation/PreparationBoard'
import { ClipboardList } from 'lucide-react'

// The DMF sheet's "VA Preparation" tab — the pre-launch pipeline for each
// VA-client engagement. Department-scoped for everyone except admins/HR, the
// same split /projects and /teams use.
export default async function VAPreparationPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const scope = await getViewScope(user)
  const unrestricted = scope === null
  const canMutate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole)

  const [preparations, teamLeaders, vas] = await Promise.all([
    getPreparations(scope),
    // Person In-Charge: Team Leaders only (team leads/temp leads, most of
    // whom are VA accounts, plus TEAM_LEADER-role users), within scope.
    prisma.user.findMany({
      where: { AND: [teamLeaderUserWhere(scopeDepartmentIds(scope)), userScopeWhere(scope)] },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    // Every VA in scope, with whether they're active: Replacement for /
    // Replaced by can name a VA who has since left, but Shadow trainer and
    // VA buffers offer active VAs only.
    prisma.vAProfile.findMany({
      where: { AND: [{ user: { userType: 'VIRTUAL_ASSISTANT' } }, vaProfileScopeWhere(scope)] },
      select: { id: true, userId: true, status: true, isActive: true, user: { select: { firstName: true, lastName: true, isActive: true } } },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    }),
  ])
  // Same rule as ACTIVE_VA_PROFILE_WHERE (lib/active-va.ts), applied in memory
  // to the list already loaded.
  const activeVas = vas.filter((v) => v.status === 'ACTIVE' && v.isActive && v.user.isActive)

  return (
    <div data-wide-page className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <ClipboardList className="h-6 w-6" />
          VA Preparation
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Client meeting through VA connect, onboarding checklist, and end-of-contract tracking
          {unrestricted ? ' across every department' : ''}.
        </p>
      </div>

      <PreparationBoard
        preparations={preparations}
        canMutate={canMutate}
        showDepartment={unrestricted || scope.departmentIds.length > 1}
        teamLeaders={teamLeaders.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() }))}
        activeVaUsers={activeVas.map((v) => ({ id: v.userId, name: `${v.user.firstName} ${v.user.lastName}`.trim() }))}
        activeVaProfiles={activeVas.map((v) => ({ id: v.id, name: `${v.user.firstName} ${v.user.lastName}`.trim() }))}
        vaProfiles={vas.map((v) => ({
          id: v.id,
          name: `${v.user.firstName} ${v.user.lastName}`.trim(),
        }))}
      />
    </div>
  )
}
