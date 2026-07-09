import { prisma } from '@/lib/prisma'

export const MAX_SIDEBAR_FAVORITES = 3
export const FAVORITE_COLORS = ['YELLOW', 'BLUE', 'RED'] as const
export type FavoriteColor = (typeof FAVORITE_COLORS)[number]

export async function getSidebarFavorites(userId: string) {
  return prisma.sidebarFavorite.findMany({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function getFeaturedFavorite(userId: string) {
  return prisma.sidebarFavorite.findFirst({
    where: { userId, isFeatured: true },
  })
}
