import { prisma } from '@/lib/prisma'
import type { Prisma } from '@/src/generated/prisma/client'
import {
  computeAvailableHours,
  computeWorkPattern,
  computeAlert,
  type AvailabilityRow,
} from '@/lib/va-availability-fields'

// Prisma reads for the DMF sheet's "VA Availability" tab (and the TMF's copy
// of it on /tmf). Server-only — anything the client board needs lives in
// lib/va-availability-fields.ts.

const num = (v: unknown): number | null => (v == null ? null : Number(v))
const iso = (d: Date | null | undefined) => d?.toISOString() ?? null

export type AvailabilityScope = {
  // `null` means every department (admin/HR); an empty array means nothing
  // is in scope and correctly returns no rows rather than falling through
  // to everything.
  departmentIds: string[] | null
  // Narrows further to specific people — the TMF passes its team's roster.
  userIds?: string[]
}

// Rows are built from active DepartmentMemberships rather than VAProfiles, so
// a VA in two departments yields two rows — each with that department's own
// DMF/TMF block and that department's own clients.
export async function getAvailabilityRows(scope: AvailabilityScope): Promise<AvailabilityRow[]> {
  const where: Prisma.DepartmentMembershipWhereInput = {
    endedAt: null,
    user: { vaProfile: { isNot: null } },
    ...(scope.departmentIds !== null && { departmentId: { in: scope.departmentIds } }),
    ...(scope.userIds && { userId: { in: scope.userIds } }),
  }

  const memberships = await prisma.departmentMembership.findMany({
    where,
    orderBy: [{ user: { firstName: 'asc' } }, { user: { lastName: 'asc' } }],
    select: {
      departmentId: true,
      department: { select: { name: true } },
      user: {
        select: {
          id: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          userType: true,
          teamMemberships: {
            where: { endedAt: null },
            select: { team: { select: { name: true, departmentId: true } } },
          },
          // Contract and employment status live on the current
          // EmploymentRecord, not VAProfile — same convention /vas uses.
          employmentRecords: {
            where: { isCurrent: true },
            take: 1,
            select: { contractType: true, employmentStatus: true },
          },
          vaProfile: {
            select: {
              id: true,
              vaaPosition: true,
              preferredWorkHours: true,
              hybridHours: true,
              availabilityStatus: true,
              status: true,
              // CURRENT WORK HOURS and CLIENT COUNT — the two the sheet keeps
              // by hand — are read straight off the live assignments instead.
              assignments: {
                where: { status: 'ACTIVE' },
                select: { agreedHours: true, clientId: true, client: { select: { departmentId: true } } },
              },
              departmentAvailabilities: {
                include: { tmfUpdatedBy: { select: { firstName: true, lastName: true } } },
              },
            },
          },
        },
      },
    },
  })

  const now = new Date()
  // A person can hold two active memberships in the same department (e.g. a
  // transfer that was never closed out); one row per (VA, department) only.
  const seen = new Set<string>()
  const rows: AvailabilityRow[] = []

  for (const m of memberships) {
    const p = m.user.vaProfile
    if (!p) continue
    const rowKey = `${p.id}:${m.departmentId}`
    if (seen.has(rowKey)) continue
    seen.add(rowKey)

    const inDept = p.assignments.filter((a) => a.client.departmentId === m.departmentId)
    const currentHours = inDept.reduce((sum, a) => sum + Number(a.agreedHours), 0)
    const totalHours = p.assignments.reduce((sum, a) => sum + Number(a.agreedHours), 0)
    const preferredHours = num(p.preferredWorkHours)
    const hybridHours = num(p.hybridHours)
    const isVA = m.user.userType === 'VIRTUAL_ASSISTANT'
    const employment = m.user.employmentRecords[0]
    const dept = p.departmentAvailabilities.find((d) => d.departmentId === m.departmentId)
    const availabilityStatus = dept?.availabilityStatus ?? p.availabilityStatus
    const tmfStatus = dept?.tmfAvailabilityStatus ?? null

    rows.push({
      rowKey,
      vaProfileId: p.id,
      departmentId: m.departmentId,
      userId: m.user.id,
      employeeId: m.user.employeeId,
      name: `${m.user.firstName} ${m.user.lastName}`.trim(),
      position: p.vaaPosition,
      departmentName: m.department.name,
      teamName: m.user.teamMemberships.find((t) => t.team.departmentId === m.departmentId)?.team.name ?? null,

      preferredHours,
      currentHours,
      otherDepartmentHours: totalHours - currentHours,
      hybridHours,
      availableHours: computeAvailableHours(preferredHours, totalHours, hybridHours),
      // Distinct clients, not assignment count — a VA on two engagements
      // with the same client is one client to a manager reading this.
      clientCount: new Set(inDept.map((a) => a.clientId)).size,

      workPattern: computeWorkPattern(isVA, preferredHours),
      availabilityStatus,
      contractType: employment?.contractType ?? null,
      generalStatus: p.status,
      employmentStatus: employment?.employmentStatus ?? null,

      isRecommended: dept?.isRecommended ?? false,
      recommendedForClient: dept?.recommendedForClient ?? null,
      recommendedUntil: dept?.recommendedUntil ?? null,

      availabilityRemarks: dept?.remarks ?? null,
      availabilityChangedAt: iso(dept?.changedAt),
      availabilityReviewDueAt: iso(dept?.reviewDueAt),
      alert: computeAlert(availabilityStatus, preferredHours, dept?.changedAt ?? null, dept?.reviewDueAt ?? null, now),

      tmfAvailabilityStatus: tmfStatus,
      tmfRemarks: dept?.tmfRemarks ?? null,
      tmfChangedAt: iso(dept?.tmfChangedAt),
      tmfReviewDueAt: iso(dept?.tmfReviewDueAt),
      tmfUpdatedByName: dept?.tmfUpdatedBy
        ? `${dept.tmfUpdatedBy.firstName} ${dept.tmfUpdatedBy.lastName}`.trim()
        : null,
      tmfAlert: computeAlert(
        tmfStatus ?? availabilityStatus,
        preferredHours,
        dept?.tmfChangedAt ?? null,
        dept?.tmfReviewDueAt ?? null,
        now
      ),
      tmfMismatch: !!dept?.availabilityStatus && !!tmfStatus && dept.availabilityStatus !== tmfStatus,
    })
  }

  return rows
}
