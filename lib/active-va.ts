import type { Prisma } from '@/src/generated/prisma/client'

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
