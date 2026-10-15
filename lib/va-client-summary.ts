import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import { ENDED_VA_STATUSES } from '@/lib/active-va'
import { assignmentScopeWhere, type Scope } from '@/lib/scope'
import type { ClientSummaryRow, SummaryLink, VaClientSummary, VaSummaryRow } from '@/lib/va-client-summary-fields'

// Prisma reads for /va-client-summary. See lib/va-client-summary-fields.ts.
//
// VA rows start from department memberships, the same roster VA Availability
// uses, so a VA with no client still gets a row (the sheet lists them too —
// that's half the point of the tab). Their clients are that department's
// active assignments only: an assignment belongs to its client's department.
export async function getVaClientSummary(scope: Scope): Promise<VaClientSummary> {
  const deptFilter = scope === null ? {} : { departmentId: { in: scope.departmentIds } }
  const userFilter = scope !== null && scope.userIds !== null ? { userId: { in: scope.userIds } } : {}

  const membershipWhere: Prisma.DepartmentMembershipWhereInput = {
    endedAt: null,
    ...deptFilter,
    ...userFilter,
    user: {
      userType: 'VIRTUAL_ASSISTANT',
      isActive: true,
      vaProfile: { is: { status: { notIn: ENDED_VA_STATUSES } } },
    },
  }

  const [memberships, assignments] = await Promise.all([
    prisma.departmentMembership.findMany({
      where: membershipWhere,
      select: {
        departmentId: true,
        department: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, vaProfile: { select: { id: true, status: true } } } },
      },
    }),
    prisma.assignment.findMany({
      where: { status: 'ACTIVE', ...assignmentScopeWhere(scope) },
      select: {
        agreedHours: true,
        vaProfile: { select: { id: true, status: true, user: { select: { firstName: true, lastName: true } } } },
        client: { select: { id: true, name: true, departmentId: true, department: { select: { name: true } } } },
      },
    }),
  ])

  const vaRows = new Map<string, VaSummaryRow>()
  const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim()

  for (const m of memberships) {
    const p = m.user.vaProfile
    if (!p) continue
    const key = `${p.id}:${m.departmentId}`
    if (vaRows.has(key)) continue
    vaRows.set(key, {
      key,
      vaProfileId: p.id,
      name: fullName(m.user),
      status: p.status,
      departmentId: m.departmentId,
      departmentName: m.department.name,
      clients: [],
      totalHours: 0,
    })
  }

  const clientRows = new Map<string, ClientSummaryRow>()

  for (const a of assignments) {
    const deptId = a.client.departmentId
    if (!deptId || !a.client.department) continue
    const hours = Number(a.agreedHours)
    const vaName = fullName(a.vaProfile.user)

    // A VA can work a department's client without holding a membership there
    // (hybrid set-ups); they still belong on this department's list.
    const key = `${a.vaProfile.id}:${deptId}`
    let va = vaRows.get(key)
    if (!va) {
      va = {
        key,
        vaProfileId: a.vaProfile.id,
        name: vaName,
        status: a.vaProfile.status,
        departmentId: deptId,
        departmentName: a.client.department.name,
        clients: [],
        totalHours: 0,
      }
      vaRows.set(key, va)
    }
    addLink(va.clients, { id: a.client.id, name: a.client.name, hours })
    va.totalHours += hours

    let client = clientRows.get(a.client.id)
    if (!client) {
      client = {
        clientId: a.client.id,
        name: a.client.name,
        departmentId: deptId,
        departmentName: a.client.department.name,
        vas: [],
        totalHours: 0,
      }
      clientRows.set(a.client.id, client)
    }
    addLink(client.vas, { id: a.vaProfile.id, name: vaName, hours })
    client.totalHours += hours
  }

  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)
  const vas = [...vaRows.values()].sort(byName)
  const clients = [...clientRows.values()].sort(byName)
  for (const v of vas) v.clients.sort(byName)
  for (const c of clients) c.vas.sort(byName)
  return { vas, clients }
}

// The same VA on the same client twice (a regular engagement plus an
// Additional Hours add-on) is one line with the hours combined, as the sheet
// writes it.
function addLink(list: SummaryLink[], link: SummaryLink) {
  const existing = list.find((l) => l.id === link.id)
  if (existing) existing.hours += link.hours
  else list.push(link)
}
