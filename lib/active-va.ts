import type { Prisma } from '@/src/generated/prisma/client'
import type { GeneralStatus } from '@/src/generated/prisma/enums'

// "Active VA" — the same rule as the VA Masterlist's Active count: a
// VIRTUAL_ASSISTANT account whose profile status is ACTIVE. The userType
// check matters: ~40 staff accounts carry a VAProfile with status ACTIVE and
// would otherwise show up in VA pickers.
//
// Both objects carry a `user`/`vaProfile` key, so combine them with other
// where-fragments via AND, never object spread (spread silently drops one).
export const ACTIVE_VA_PROFILE_WHERE: Prisma.VAProfileWhereInput = {
  status: 'ACTIVE',
  isActive: true,
  user: { userType: 'VIRTUAL_ASSISTANT', isActive: true },
}

export const ACTIVE_VA_USER_WHERE: Prisma.UserWhereInput = {
  userType: 'VIRTUAL_ASSISTANT',
  isActive: true,
  vaProfile: { is: { status: 'ACTIVE', isActive: true } },
}

// VAs who have left: resigned, removed, blacklisted, or whose engagement
// ended. Department memberships and team rosters aren't closed out when that
// happens, so the working views (VA Availability, Team Assignment) filter on
// this instead — Amazon alone had ~430 of them on its VA Availability tab.
// Deliberately narrower than "not ACTIVE": Pending and Transferred VAs are
// still on the DMF's rosters. The Masterlist keeps them under its own filter.
export const ENDED_VA_STATUSES: GeneralStatus[] = ['RESIGNED', 'REMOVED', 'BLACKLISTED', 'PROJECT_ENDED', 'CANCELLED']

// A User who isn't an ended VA (staff accounts without a VA profile pass).
export const NOT_ENDED_VA_USER_WHERE: Prisma.UserWhereInput = {
  NOT: { vaProfile: { is: { status: { in: ENDED_VA_STATUSES } } } },
}

export function isEndedVAStatus(status: string | null | undefined): boolean {
  return !!status && (ENDED_VA_STATUSES as string[]).includes(status)
}

export const ENDED_VA_STATUS_LABEL: Record<string, string> = {
  RESIGNED: 'Resigned',
  REMOVED: 'Removed',
  BLACKLISTED: 'Blacklisted',
  PROJECT_ENDED: 'Project Ended',
  CANCELLED: 'Cancelled',
}
