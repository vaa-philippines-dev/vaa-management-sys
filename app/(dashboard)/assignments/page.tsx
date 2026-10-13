import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { getCurrentUser, ASSIGNMENT_MUTATOR_ROLES } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { getViewScope, assignmentScopeWhere, scopeKey as toScopeKey } from '@/lib/scope'
import { clientCompanyName, clientDisplayName } from '@/lib/clients/display'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Plus, Briefcase } from 'lucide-react'
import { format } from 'date-fns'
import { AssignmentsBoard } from '@/components/assignments/AssignmentsBoard'
import type { AssignmentRow } from '@/components/assignments/AssignmentCard'
import { redirect } from 'next/navigation'

export default async function AssignmentsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  let where: Prisma.AssignmentWhereInput = {}
  let scopeKey = 'all'
  let multiDepartment = true
  if (isVA) {
    // Scope to '' rather than undefined when a VA has no profile row yet — Prisma
    // treats `undefined` as "filter not provided" and would return every assignment.
    const vaProfileId = user.vaProfile?.id ?? ''
    where = { vaProfileId }
    scopeKey = `va:${vaProfileId}`
  } else {
    // Staff see only assignments whose client sits in one of their departments —
    // a VA shared between PPC and Amazon must not surface Amazon work to PPC.
    const scope = await getViewScope(user)
    where = assignmentScopeWhere(scope)
    scopeKey = toScopeKey(scope)
    multiDepartment = scope === null || scope.departmentIds.length > 1
  }

  // Cache key must carry every value the `where` closure depends on — a static
  // key here served an admin's full list to the next VA who loaded the page.
  const assignments = await cached(`assignments:board:${scopeKey}`, [CACHE_TAGS.assignments], 30, () =>
    prisma.assignment.findMany({
      where,
      select: {
        id: true,
        type: true,
        status: true,
        agreedHours: true,
        startDate: true,
        endDate: true,
        parentAssignmentId: true,
        client: {
          select: { id: true, name: true, contactName: true, department: { select: { name: true } } },
        },
        vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true, email: true } } } },
        workLogs: { select: { hours: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    })
  )

  const rows: AssignmentRow[] = assignments.map((a) => {
    const vaUser = a.vaProfile.user
    // new Date(): the cached() result comes back JSON-serialized, so these are strings.
    const start = new Date(a.startDate)
    const end = a.endDate ? new Date(a.endDate) : null
    return {
      id: a.id,
      type: a.type,
      status: a.status,
      clientId: a.client.id,
      clientName: clientDisplayName(a.client),
      clientCompany: clientCompanyName(a.client),
      departmentName: a.client.department?.name ?? null,
      vaProfileId: a.vaProfile.id,
      vaName: `${vaUser.firstName} ${vaUser.lastName}`.trim() || vaUser.email,
      agreedHours: Number(a.agreedHours),
      loggedHours: a.workLogs.reduce((s, l) => s + Number(l.hours), 0),
      startTime: start.getTime(),
      startLabel: format(start, 'MMM dd, yyyy'),
      endLabel: end ? format(end, 'MMM dd, yyyy') : null,
      isAdditional: Boolean(a.parentAssignmentId),
    }
  })

  const canCreate = ASSIGNMENT_MUTATOR_ROLES.includes(user.systemRole)

  return (
    <div data-wide-page className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6" />
            Assignments
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isVA ? 'Your client engagements' : 'VA-to-client engagements, regular and project-based'}
          </p>
        </div>
        {canCreate && (
          <Link href="/assignments/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Assignment
            </Button>
          </Link>
        )}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">No assignments yet.</p>
          </CardContent>
        </Card>
      ) : (
        <AssignmentsBoard rows={rows} showDepartment={multiDepartment} showVA={!isVA} />
      )}
    </div>
  )
}
