import { prisma } from '@/lib/prisma'
import { getCurrentUser, getManagedDepartmentIds } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { CelebrantsCalendar, type CelebrantEvent } from '@/components/celebrants/CelebrantsCalendar'

const FULL_ADMIN_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'HR']

// Prisma's DateTime? type is Date | null at compile time, but a malformed
// underlying value can still surface as something other than a real Date at
// runtime — coerce defensively rather than assume the type holds.
function toValidDate(value: unknown): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value as string)
  return isNaN(d.getTime()) ? null : d
}

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

export default async function CelebrantsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const isFullAdmin = FULL_ADMIN_ROLES.includes(user.systemRole)
  const isVA = user.userType === 'VIRTUAL_ASSISTANT'

  let scopedDeptIds: string[] | undefined
  if (!isFullAdmin) {
    scopedDeptIds = isVA
      ? (user.memberships ?? []).filter((m) => !m.endedAt).map((m) => m.departmentId)
      : getManagedDepartmentIds(user)
  }

  const [birthdayUsers, anniversaryUsers] = await Promise.all([
    prisma.user.findMany({
      where: {
        profile: { birthDate: { not: null }, nonCelebrant: false, birthdayCelebrant: true },
        ...(scopedDeptIds ? { memberships: { some: { departmentId: { in: scopedDeptIds }, endedAt: null } } } : {}),
      },
      include: { profile: true },
    }),
    prisma.user.findMany({
      where: scopedDeptIds ? { memberships: { some: { departmentId: { in: scopedDeptIds }, endedAt: null } } } : undefined,
      include: {
        vaProfile: true,
        // Current staff-era record (isCurrent: true) is the authoritative "Staff Anniversary"
        // source once promoted; historical VA-era records stay queryable but are not
        // treated as "the" active anniversary for a promoted user.
        employmentRecords: { orderBy: { startDate: 'desc' } },
      },
    }),
  ])

  const events: CelebrantEvent[] = []

  for (const u of birthdayUsers) {
    const birthDate = toValidDate(u.profile!.birthDate)
    if (!birthDate) continue
    events.push({
      id: `bday:${u.id}`,
      name: `${u.firstName} ${u.lastName}`,
      type: 'birthday',
      month: birthDate.getMonth(),
      day: birthDate.getDate(),
    })
  }

  for (const u of anniversaryUsers) {
    const currentEmploymentRecord = u.employmentRecords.find((er) => er.isCurrent)
    const history: string[] = []

    let label: 'VA Anniversary' | 'Staff Anniversary' | null = null
    let currentDate: Date | null = null

    const vaHireDate = toValidDate(u.vaProfile?.currentHireDate)

    if (u.userType === 'VIRTUAL_ASSISTANT' && vaHireDate) {
      label = 'VA Anniversary'
      currentDate = vaHireDate
    } else if (u.userType === 'INTERNAL_STAFF' && currentEmploymentRecord) {
      const staffStartDate = toValidDate(currentEmploymentRecord.startDate)
      if (staffStartDate) {
        label = 'Staff Anniversary'
        currentDate = staffStartDate
        // Preserve the VA-era hire date as historical context — it must remain
        // visible but must not be treated as the active anniversary once promoted.
        if (vaHireDate) {
          history.push(`VA Anniversary (previous) since ${formatMonthDay(vaHireDate)}`)
        }
      }
    }

    // Any non-current employment records are additional history, regardless of userType.
    for (const er of u.employmentRecords) {
      if (!er.isCurrent) {
        const startDate = toValidDate(er.startDate)
        if (startDate) history.push(`Prior employment record since ${formatMonthDay(startDate)}`)
      }
    }

    if (label && currentDate) {
      events.push({
        id: `anniv:${u.id}`,
        name: `${u.firstName} ${u.lastName}`,
        type: 'anniversary',
        month: currentDate.getMonth(),
        day: currentDate.getDate(),
        label,
        history: history.length > 0 ? history : undefined,
      })
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Celebrants</h2>
        <p className="text-sm text-muted-foreground mt-1">Birthdays and work anniversaries across the org</p>
      </div>
      <CelebrantsCalendar events={events} />
    </div>
  )
}
