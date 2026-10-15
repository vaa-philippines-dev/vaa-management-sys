import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import {
  getCurrentUser,
  getManagedDepartmentIds,
  isDepartmentUnrestricted,
  DEPARTMENT_SCOPED_ROLES,
  DMF_RECORD_DELETE_ROLES,
} from '@/lib/auth'
import { ENDED_VA_STATUSES } from '@/lib/active-va'
import type { ConcernPermissions, ConcernRow, ConcernVaOption } from '@/lib/va-concerns-fields'

// Who may see and change which VA concerns. Server-only; labels and row
// types are in lib/va-concerns-fields.ts.
//
// Like the TMF (lib/tmf.ts), leading a team is what lets someone raise
// concerns, not a SystemRole — most Team Leaders are VA accounts. Four tiers:
//   • Admins and HR: every department, every field.
//   • EXECUTIVE: every department, read-only.
//   • Dept/Ops Manager: their departments, every field (they are the
//     sheet's ADM/OM column and record what the escalation teams did).
//   • Team Leader (leader or temp leader of a team): concerns about the VAs on
//     the teams they lead, in that team's department only. They write the
//     concern itself and the TEAM LEADER action; the manager and escalation
//     columns stay read-only for them.

type ConcernUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

export type ConcernAccess = {
  userId: string
  viewAll: boolean
  editAll: boolean
  canDelete: boolean
  // Departments whose concerns this user manages outright.
  managedDepartmentIds: string[]
  // departmentId → user ids of the VAs on the teams this user leads there.
  ledTeamMembers: Map<string, Set<string>>
}

export async function getConcernAccess(user: ConcernUser): Promise<ConcernAccess> {
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'
  const editAll = !isVA && isDepartmentUnrestricted(user)
  const viewAll = editAll || (!isVA && user.systemRole === 'EXECUTIVE')
  const managedDepartmentIds =
    !isVA && !viewAll && DEPARTMENT_SCOPED_ROLES.includes(user.systemRole) ? getManagedDepartmentIds(user) : []

  const teams = await prisma.team.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ leaderId: user.id }, { tempLeader1Id: user.id }, { tempLeader2Id: user.id }],
    },
    select: { departmentId: true, memberships: { where: { endedAt: null }, select: { userId: true } } },
  })
  const ledTeamMembers = new Map<string, Set<string>>()
  for (const t of teams) {
    const set = ledTeamMembers.get(t.departmentId) ?? new Set<string>()
    for (const m of t.memberships) if (m.userId !== user.id) set.add(m.userId)
    ledTeamMembers.set(t.departmentId, set)
  }

  return {
    userId: user.id,
    viewAll,
    editAll,
    canDelete: !isVA && DMF_RECORD_DELETE_ROLES.includes(user.systemRole),
    managedDepartmentIds,
    ledTeamMembers,
  }
}

export function canOpenConcerns(access: ConcernAccess): boolean {
  return access.viewAll || access.managedDepartmentIds.length > 0 || access.ledTeamMembers.size > 0
}

export function canRaiseConcerns(access: ConcernAccess): boolean {
  return access.editAll || access.managedDepartmentIds.length > 0 || access.ledTeamMembers.size > 0
}

// Rows this user may read. Never falls through to "everything" for a scoped
// user: with nothing in scope the OR is empty and matches no rows.
export function concernScopeWhere(access: ConcernAccess): Prisma.VAConcernWhereInput {
  if (access.viewAll) return {}
  const or: Prisma.VAConcernWhereInput[] = []
  if (access.managedDepartmentIds.length > 0) or.push({ departmentId: { in: access.managedDepartmentIds } })
  for (const [departmentId, userIds] of access.ledTeamMembers) {
    or.push({ departmentId, vaProfile: { userId: { in: [...userIds] } } })
  }
  return or.length > 0 ? { OR: or } : { id: { in: [] } }
}

export function concernPermissions(
  access: ConcernAccess,
  concern: { departmentId: string; vaUserId: string }
): ConcernPermissions {
  const manages = access.editAll || access.managedDepartmentIds.includes(concern.departmentId)
  const leads = access.ledTeamMembers.get(concern.departmentId)?.has(concern.vaUserId) ?? false
  return {
    canEditConcern: manages || leads,
    canEditManagerFields: manages,
    canDelete: access.canDelete,
  }
}

const concernInclude = {
  department: { select: { name: true } },
  vaProfile: { select: { userId: true, user: { select: { firstName: true, lastName: true } } } },
  client: { select: { name: true } },
  reportedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.VAConcernInclude

type ConcernWithRelations = Prisma.VAConcernGetPayload<{ include: typeof concernInclude }>

function toRow(c: ConcernWithRelations, access: ConcernAccess): ConcernRow {
  return {
    id: c.id,
    number: c.number,
    departmentId: c.departmentId,
    departmentName: c.department.name,
    vaProfileId: c.vaProfileId,
    vaName: `${c.vaProfile.user.firstName} ${c.vaProfile.user.lastName}`.trim(),
    clientId: c.clientId,
    clientName: c.client?.name ?? c.clientName,
    concernDate: c.concernDate.toISOString(),
    category: c.category,
    concern: c.concern,
    description: c.description,
    suggestedMitigation: c.suggestedMitigation,
    status: c.status,
    escalatedTo: c.escalatedTo,
    escalationStatus: c.escalationStatus,
    teamLeaderAction: c.teamLeaderAction,
    managerAction: c.managerAction,
    hrAction: c.hrAction,
    clientExperienceAction: c.clientExperienceAction,
    businessProcessAction: c.businessProcessAction,
    accountingAction: c.accountingAction,
    referenceUrl: c.referenceUrl,
    recordingUrl: c.recordingUrl,
    escalationReference: c.escalationReference,
    sheetConcernId: c.sheetConcernId,
    reportedByName: c.reportedBy ? `${c.reportedBy.firstName} ${c.reportedBy.lastName}`.trim() : null,
    resolvedAt: c.resolvedAt?.toISOString() ?? null,
    updatedAt: c.updatedAt.toISOString(),
    permissions: concernPermissions(access, { departmentId: c.departmentId, vaUserId: c.vaProfile.userId }),
  }
}

export async function getConcernRows(access: ConcernAccess): Promise<ConcernRow[]> {
  const concerns = await prisma.vAConcern.findMany({
    where: concernScopeWhere(access),
    include: concernInclude,
    orderBy: [{ concernDate: 'desc' }, { number: 'desc' }],
  })
  return concerns.map((c) => toRow(c, access))
}

// The VAs this user can raise a concern about: everyone (not ended) in the
// departments they manage, plus the members of the teams they lead — each
// with their current clients in that department.
export async function getConcernVaOptions(access: ConcernAccess): Promise<ConcernVaOption[]> {
  if (!canRaiseConcerns(access)) return []

  const or: Prisma.DepartmentMembershipWhereInput[] = []
  if (!access.editAll) {
    if (access.managedDepartmentIds.length > 0) or.push({ departmentId: { in: access.managedDepartmentIds } })
    for (const [departmentId, userIds] of access.ledTeamMembers) {
      or.push({ departmentId, userId: { in: [...userIds] } })
    }
  }

  const memberships = await prisma.departmentMembership.findMany({
    where: {
      endedAt: null,
      department: { level: 'SERVICE' },
      user: {
        userType: 'VIRTUAL_ASSISTANT',
        isActive: true,
        vaProfile: { is: { status: { notIn: ENDED_VA_STATUSES } } },
      },
      ...(or.length > 0 && { OR: or }),
    },
    select: {
      departmentId: true,
      department: { select: { name: true } },
      user: {
        select: {
          firstName: true,
          lastName: true,
          vaProfile: {
            select: {
              id: true,
              assignments: {
                where: { status: { in: ['ACTIVE', 'PAUSED', 'ON_HOLD'] } },
                select: { client: { select: { id: true, name: true, departmentId: true } } },
              },
            },
          },
        },
      },
    },
  })

  const options = new Map<string, ConcernVaOption>()
  for (const m of memberships) {
    const p = m.user.vaProfile
    if (!p) continue
    const key = `${p.id}:${m.departmentId}`
    if (options.has(key)) continue
    const clients = new Map<string, string>()
    for (const a of p.assignments) if (a.client.departmentId === m.departmentId) clients.set(a.client.id, a.client.name)
    options.set(key, {
      key,
      vaProfileId: p.id,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      departmentId: m.departmentId,
      departmentName: m.department.name,
      clients: [...clients].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    })
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name))
}

// The department's Dept/Ops Managers — told when a Team Leader raises a
// concern or escalates one to them.
export async function getDepartmentManagerIds(departmentId: string): Promise<string[]> {
  const managers = await prisma.user.findMany({
    where: {
      isActive: true,
      systemRole: { in: DEPARTMENT_SCOPED_ROLES as ('DEPT_MANAGER' | 'OPERATIONS_MANAGER')[] },
      memberships: { some: { departmentId, endedAt: null } },
    },
    select: { id: true },
  })
  return managers.map((m) => m.id)
}
