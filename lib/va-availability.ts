import { prisma } from '@/lib/prisma'
import {
  computeAvailableHours,
  computeWorkPattern,
  computeAlert,
  type AvailabilityRow,
} from '@/lib/va-availability-fields'

// Prisma reads for the DMF sheet's "VA Availability" tab. Server-only —
// anything the client board needs lives in lib/va-availability-fields.ts.

const num = (v: unknown): number | null => (v == null ? null : Number(v))

// `departmentIds: null` means every department (admin/HR); an empty array
// means nothing is in scope and correctly returns no rows rather than
// falling through to everything.
export async function getAvailabilityRows(departmentIds: string[] | null): Promise<AvailabilityRow[]> {
  const profiles = await prisma.vAProfile.findMany({
    where:
      departmentIds === null
        ? {}
        : { user: { memberships: { some: { departmentId: { in: departmentIds }, endedAt: null } } } },
    select: {
      id: true,
      userId: true,
      vaaPosition: true,
      preferredWorkHours: true,
      hybridHours: true,
      availabilityStatus: true,
      status: true,
      isRecommended: true,
      recommendedForClient: true,
      recommendedUntil: true,
      availabilityRemarks: true,
      availabilityChangedAt: true,
      availabilityReviewDueAt: true,
      // CURRENT WORK HOURS and CLIENT COUNT — the two the sheet keeps by
      // hand — are read straight off the live assignments instead.
      assignments: {
        where: { status: 'ACTIVE' },
        select: { agreedHours: true, clientId: true },
      },
      user: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
          userType: true,
          memberships: {
            where: { endedAt: null },
            select: { isPrimary: true, department: { select: { name: true } } },
          },
          teamMemberships: {
            where: { endedAt: null },
            take: 1,
            select: { team: { select: { name: true } } },
          },
          // Contract and employment status live on the current
          // EmploymentRecord, not VAProfile — same convention /vas uses.
          employmentRecords: {
            where: { isCurrent: true },
            take: 1,
            select: { contractType: true, employmentStatus: true },
          },
        },
      },
    },
  })

  const now = new Date()

  return profiles.map((p) => {
    const currentHours = p.assignments.reduce((sum, a) => sum + Number(a.agreedHours), 0)
    const preferredHours = num(p.preferredWorkHours)
    const hybridHours = num(p.hybridHours)
    const isVA = p.user.userType === 'VIRTUAL_ASSISTANT'
    const primary = p.user.memberships.find((m) => m.isPrimary) ?? p.user.memberships[0]
    const employment = p.user.employmentRecords[0]

    return {
      vaProfileId: p.id,
      userId: p.userId,
      employeeId: p.user.employeeId,
      name: `${p.user.firstName} ${p.user.lastName}`.trim(),
      position: p.vaaPosition,
      departmentName: primary?.department.name ?? null,
      teamName: p.user.teamMemberships[0]?.team.name ?? null,

      preferredHours,
      currentHours,
      hybridHours,
      availableHours: computeAvailableHours(preferredHours, currentHours, hybridHours),
      // Distinct clients, not assignment count — a VA on two engagements
      // with the same client is one client to a manager reading this.
      clientCount: new Set(p.assignments.map((a) => a.clientId)).size,

      workPattern: computeWorkPattern(isVA, preferredHours),
      availabilityStatus: p.availabilityStatus,
      contractType: employment?.contractType ?? null,
      generalStatus: p.status,
      employmentStatus: employment?.employmentStatus ?? null,

      isRecommended: p.isRecommended,
      recommendedForClient: p.recommendedForClient,
      recommendedUntil: p.recommendedUntil,

      availabilityRemarks: p.availabilityRemarks,
      availabilityChangedAt: p.availabilityChangedAt?.toISOString() ?? null,
      availabilityReviewDueAt: p.availabilityReviewDueAt?.toISOString() ?? null,
      alert: computeAlert(
        p.availabilityStatus,
        preferredHours,
        p.availabilityChangedAt,
        p.availabilityReviewDueAt,
        now
      ),
    }
  })
}
