import { prisma } from '@/lib/prisma'
import {
  FULL_TIME_HOURS,
  PART_TIME_FLOOR_HOURS,
  computeAvailableHours,
} from '@/lib/va-availability-fields'

// The composition half of the DMF sheet's "Headcount" tab — the ~108 metric
// columns bucketing the workforce by engagement state, work pattern and
// availability.
//
// IMPORTANT: this is a point-in-time read, not a time series. The sheet
// stores a row per month and per week because a spreadsheet can't recompute
// what the FT/PT split looked like last March; neither can this app, because
// VAProfile holds only current state and nothing snapshots it. The movement
// metrics (hires, EOCs, transfers) ARE historical and stay on the monthly
// table in reports/headcount/page.tsx, which reads dated EmploymentRecords.
// A genuine monthly composition series needs a stored snapshot written on a
// schedule — deliberately not faked here.

export type HeadcountBucket = { label: string; value: number; hint?: string }

export type HeadcountComposition = {
  asOf: string
  totalVAs: number
  engagement: HeadcountBucket[]
  activePattern: HeadcountBucket[]
  idle: HeadcountBucket[]
  availability: HeadcountBucket[]
  recommended: HeadcountBucket[]
}

// The sheet's part-time tiers. FULL_TIME_HOURS / PART_TIME_FLOOR_HOURS are
// shared with VA Availability and the dashboard's Headcount card so all
// three can't drift; the 2-hour tier only exists here.
const PART_TIME_MIN_HOURS = 10

export async function getHeadcountComposition(
  departmentIds: string[] | null
): Promise<HeadcountComposition> {
  const profiles = await prisma.vAProfile.findMany({
    where:
      departmentIds === null
        ? {}
        : { user: { memberships: { some: { departmentId: { in: departmentIds }, endedAt: null } } } },
    select: {
      status: true,
      onHold: true,
      engagementStatus: true,
      availabilityStatus: true,
      preferredWorkHours: true,
      hybridHours: true,
      isRecommended: true,
      currentHireDate: true,
      assignments: { where: { status: 'ACTIVE' }, select: { agreedHours: true } },
    },
  })

  const now = new Date()
  // "Newbie" in the sheet means someone hired recently who hasn't been
  // placed yet — distinct from an experienced VA who has simply come free.
  const newbieCutoff = new Date(now.getTime() - 90 * 86_400_000)

  let active = 0
  let idle = 0
  let onHold = 0
  let activeFT = 0
  let activePT8 = 0
  let activePT4 = 0
  let activePT2 = 0
  let idleNewbie = 0
  let idleUnassigned = 0
  let idleOnHold = 0
  let forResignation = 0
  let forRemoval = 0
  let availFT = 0
  let availPT = 0
  let availPTMin = 0
  let recommended = 0
  let recommendedIdle = 0

  for (const p of profiles) {
    const hasClient = p.assignments.length > 0
    const preferred = p.preferredWorkHours == null ? null : Number(p.preferredWorkHours)
    const bookedHours = p.assignments.reduce((s, a) => s + Number(a.agreedHours), 0)
    const hybrid = p.hybridHours == null ? null : Number(p.hybridHours)

    const exiting =
      p.engagementStatus === 'RESIGNED' || p.engagementStatus === 'TERMINATED'
    if (p.engagementStatus === 'RESIGNED') forResignation++
    if (p.engagementStatus === 'TERMINATED') forRemoval++

    if (p.onHold) {
      onHold++
      if (!hasClient) idleOnHold++
      continue
    }
    // Anyone already out of the workforce (removed/resigned records) is
    // neither active nor idle capacity — counting them would inflate both.
    if (p.status !== 'ACTIVE' || exiting) continue

    if (hasClient) {
      active++
      const hours = preferred ?? bookedHours
      if (hours >= FULL_TIME_HOURS) activeFT++
      else if (hours >= PART_TIME_FLOOR_HOURS) activePT8++
      else if (hours >= PART_TIME_MIN_HOURS) activePT4++
      else activePT2++
    } else {
      idle++
      if (p.currentHireDate && p.currentHireDate >= newbieCutoff) idleNewbie++
      else idleUnassigned++
    }

    const free = computeAvailableHours(preferred, bookedHours, hybrid)
    if (free > 0) {
      if (free >= FULL_TIME_HOURS) availFT++
      else if (free >= PART_TIME_FLOOR_HOURS) availPT++
      else availPTMin++
    }

    if (p.isRecommended) {
      recommended++
      if (!hasClient) recommendedIdle++
    }
  }

  return {
    asOf: now.toISOString(),
    totalVAs: profiles.length,
    engagement: [
      { label: 'Active (with client)', value: active },
      { label: 'Idle (no client)', value: idle },
      { label: 'On hold', value: onHold },
      { label: 'For resignation', value: forResignation },
      { label: 'For removal', value: forRemoval },
    ],
    activePattern: [
      { label: 'Full time', value: activeFT, hint: `${FULL_TIME_HOURS}h+ / week` },
      { label: 'Part time', value: activePT8, hint: `${PART_TIME_FLOOR_HOURS}–${FULL_TIME_HOURS}h` },
      { label: 'Part time <4h/day', value: activePT4, hint: `${PART_TIME_MIN_HOURS}–${PART_TIME_FLOOR_HOURS}h` },
      { label: 'Part time <2h/day', value: activePT2, hint: `under ${PART_TIME_MIN_HOURS}h` },
    ],
    idle: [
      { label: 'Newbie', value: idleNewbie, hint: 'hired in the last 90 days, not yet placed' },
      { label: 'Unassigned', value: idleUnassigned },
      { label: 'On hold', value: idleOnHold },
    ],
    availability: [
      { label: 'Full time capacity', value: availFT, hint: `${FULL_TIME_HOURS}h+ free` },
      { label: 'Part time capacity', value: availPT, hint: `${PART_TIME_FLOOR_HOURS}–${FULL_TIME_HOURS}h free` },
      { label: 'Minimum capacity', value: availPTMin, hint: `under ${PART_TIME_FLOOR_HOURS}h free` },
    ],
    recommended: [
      { label: 'Recommended', value: recommended },
      { label: 'Recommended and idle', value: recommendedIdle, hint: 'ready to place now' },
    ],
  }
}
