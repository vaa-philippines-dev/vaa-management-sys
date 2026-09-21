import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  ASSIGNMENT_MUTATOR_ROLES,
} from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getPreparations } from '@/lib/va-preparation'
import { PreparationBoard } from '@/components/va-preparation/PreparationBoard'
import { ClipboardList } from 'lucide-react'

// The DMF sheet's "VA Preparation" tab — the pre-launch pipeline for each
// VA-client engagement. Department-scoped for everyone except admins/HR, the
// same split /projects and /teams use.
export default async function VAPreparationPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const unrestricted = isDepartmentUnrestricted(user)
  const managedIds = getManagedDepartmentIds(user)
  const canMutate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole)

  const [preparations, staff, vas] = await Promise.all([
    getPreparations(unrestricted ? null : managedIds),
    // Person In-Charge and Shadow Trainer are both internal people, which in
    // this business includes VAs acting as shadow trainers — so this picker
    // deliberately isn't filtered to non-VA users the way /projects' owner
    // picker is.
    prisma.user.findMany({
      where: {
        isActive: true,
        ...(unrestricted
          ? {}
          : { memberships: { some: { departmentId: { in: managedIds }, endedAt: null } } }),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.vAProfile.findMany({
      where: {
        ...(unrestricted
          ? {}
          : { user: { memberships: { some: { departmentId: { in: managedIds }, endedAt: null } } } }),
      },
      select: { id: true, user: { select: { firstName: true, lastName: true } } },
      orderBy: { user: { firstName: 'asc' } },
    }),
  ])

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
        showDepartment={unrestricted || managedIds.length > 1}
        people={staff.map((s) => ({ id: s.id, name: `${s.firstName} ${s.lastName}`.trim() }))}
        vaProfiles={vas.map((v) => ({
          id: v.id,
          name: `${v.user.firstName} ${v.user.lastName}`.trim(),
        }))}
      />
    </div>
  )
}
