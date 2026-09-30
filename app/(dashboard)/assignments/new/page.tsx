import { prisma } from '@/lib/prisma'
import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getMutateScope, clientScopeWhere, vaProfileScopeWhere } from '@/lib/scope'
import { ACTIVE_VA_PROFILE_WHERE } from '@/lib/active-va'
import { clientDisplayName, clientOptionLabel } from '@/lib/clients/display'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AssignmentForm } from '@/components/assignments/AssignmentForm'

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>
}) {
  const currentUser = await getCurrentUser()
  if (!currentUser || !ASSIGNMENT_MUTATOR_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const { clientId } = await searchParams

  // Pickers only offer what createAssignment() will accept: clients in the
  // viewer's departments and active VAs (same rule as the Masterlist's Active
  // count) with an active membership in one of them. A Team Leader gets every
  // client of their teams' departments but only the VAs on the teams they lead.
  const scope = await getMutateScope(currentUser)
  const clientScope = scope && { departmentIds: scope.departmentIds, userIds: null }

  const [clients, vas] = await Promise.all([
    prisma.client.findMany({ where: { status: 'ACTIVE', ...clientScopeWhere(clientScope) }, orderBy: { name: 'asc' } }),
    prisma.vAProfile.findMany({
      where: { AND: [ACTIVE_VA_PROFILE_WHERE, vaProfileScopeWhere(scope)] },
      include: { user: true, vaSkills: { include: { skill: true } } },
      orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    }),
  ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Assignment</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Match a VA to a client with agreed hours
        </p>
      </div>
      <AssignmentForm
        clients={clients
          .sort((a, b) => clientDisplayName(a).localeCompare(clientDisplayName(b)))
          .map((c) => ({
            id: c.id,
            name: clientOptionLabel(c),
            requiredSkills: c.requiredSkills,
          }))}
        vas={vas.map((v) => ({
          id: v.id,
          name: [v.user.firstName, v.user.lastName].filter(Boolean).join(' ').trim() || v.user.email,
          skills: v.vaSkills.map((s) => s.skill.name),
        }))}
        defaultClientId={clientId}
      />
    </div>
  )
}