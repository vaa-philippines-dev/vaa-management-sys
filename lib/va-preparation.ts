import { prisma } from '@/lib/prisma'
import { CHECKLIST_FIELDS, type ChecklistKey, type PreparationRow } from '@/lib/va-preparation-fields'

// Prisma reads for the DMF sheet's "VA Preparation" tab. Server-only —
// anything the client board needs lives in lib/va-preparation-fields.ts.

const fullName = (u: { firstName: string; lastName: string } | null | undefined) =>
  u ? `${u.firstName} ${u.lastName}`.trim() : null

const iso = (d: Date | null | undefined) => d?.toISOString() ?? null

const preparationInclude = {
  assignment: {
    select: {
      id: true,
      startDate: true,
      client: { select: { name: true, department: { select: { name: true } } } },
      vaProfile: {
        select: {
          id: true,
          user: {
            select: {
              firstName: true,
              lastName: true,
              teamMemberships: {
                where: { endedAt: null },
                take: 1,
                select: { team: { select: { name: true } } },
              },
            },
          },
        },
      },
    },
  },
  replacementFor: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  replacedBy: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
  personInCharge: { select: { id: true, firstName: true, lastName: true } },
  shadowTrainer: { select: { id: true, firstName: true, lastName: true } },
} as const

type RawPreparation = Awaited<
  ReturnType<typeof prisma.assignmentPreparation.findMany<{ include: typeof preparationInclude }>>
>[number]

function toRow(p: RawPreparation): PreparationRow {
  const checklist = Object.fromEntries(
    CHECKLIST_FIELDS.map(({ key }) => [key, p[key] as boolean])
  ) as Record<ChecklistKey, boolean>

  return {
    id: p.id,
    assignmentId: p.assignmentId,
    vaProfileId: p.assignment.vaProfile.id,
    vaName: fullName(p.assignment.vaProfile.user) ?? 'Unknown VA',
    clientName: p.assignment.client.name,
    departmentName: p.assignment.client.department?.name ?? null,
    teamName: p.assignment.vaProfile.user.teamMemberships[0]?.team.name ?? null,

    startStatus: p.startStatus,
    targetStartDate: iso(p.targetStartDate),
    actualStartDate: iso(p.assignment.startDate),
    vaType: p.vaType,
    scheduleType: p.scheduleType,
    scheduleDays: p.scheduleDays,
    expertiseGroup: p.expertiseGroup,
    vaBuffers: p.vaBuffers,
    vaClientFileUrl: p.vaClientFileUrl,
    accountDocUrl: p.accountDocUrl,
    replacementForId: p.replacementFor?.id ?? null,
    replacementForName: fullName(p.replacementFor?.user),
    personInChargeId: p.personInCharge?.id ?? null,
    personInChargeName: fullName(p.personInCharge),
    shadowTrainerId: p.shadowTrainer?.id ?? null,
    shadowTrainerName: fullName(p.shadowTrainer),

    clientMeetingDate: iso(p.clientMeetingDate),
    clientMeetingStatus: p.clientMeetingStatus,
    preparationStartDate: iso(p.preparationStartDate),
    preparationEndDate: iso(p.preparationEndDate),
    preparationCallDate: iso(p.preparationCallDate),
    preparationCallStatus: p.preparationCallStatus,
    mockInterviewDate: iso(p.mockInterviewDate),
    mockInterviewStatus: p.mockInterviewStatus,
    vaConnectDate: iso(p.vaConnectDate),
    vaConnectStatus: p.vaConnectStatus,

    checklist,
    checklistDone: CHECKLIST_FIELDS.filter(({ key }) => p[key]).length,

    clientStatus: p.clientStatus,
    effectivityDate: iso(p.effectivityDate),
    statusReason: p.statusReason,
    replacementNote: p.replacementNote,
    replacedById: p.replacedBy?.id ?? null,
    replacedByName: fullName(p.replacedBy?.user),

    missingEffectivityDate: p.clientStatus !== 'ACTIVE' && p.effectivityDate === null,
  }
}

// `departmentIds: null` means "every department" (admin/HR); an empty array
// means "no departments in scope" and correctly returns nothing rather than
// falling back to everything.
export async function getPreparations(departmentIds: string[] | null): Promise<PreparationRow[]> {
  const rows = await prisma.assignmentPreparation.findMany({
    where: departmentIds === null ? {} : { assignment: { client: { departmentId: { in: departmentIds } } } },
    include: preparationInclude,
    orderBy: [{ targetStartDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
  })
  return rows.map(toRow)
}

// The third rule of the dashboard's "Missing / Incomplete / Incorrect Data"
// panel, which was stubbed until this module existed: rows parked as
// Paused/End of Work with no effectivity date recorded against them.
export async function getPreparationsMissingEffectivityDate(departmentId: string) {
  const rows = await prisma.assignmentPreparation.findMany({
    where: {
      clientStatus: { in: ['PAUSED', 'END_OF_WORK'] },
      effectivityDate: null,
      assignment: { client: { departmentId } },
    },
    select: {
      id: true,
      clientStatus: true,
      assignment: {
        select: {
          client: { select: { name: true } },
          vaProfile: { select: { id: true, user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  })

  return rows.map((r) => ({
    id: r.id,
    vaProfileId: r.assignment.vaProfile.id,
    name: fullName(r.assignment.vaProfile.user) ?? 'Unknown VA',
    clientName: r.assignment.client.name,
    clientStatus: r.clientStatus,
  }))
}
