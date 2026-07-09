'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { MAX_SIDEBAR_FAVORITES, FAVORITE_COLORS, type FavoriteColor } from '@/lib/favorites'

export async function addFavorite(href: string, label: string, color: FavoriteColor) {
  const user = await requireAuth()
  if (!FAVORITE_COLORS.includes(color)) return { error: 'Invalid color' }

  const count = await prisma.sidebarFavorite.count({ where: { userId: user.id } })
  const existing = await prisma.sidebarFavorite.findUnique({
    where: { userId_href: { userId: user.id, href } },
  })
  if (!existing && count >= MAX_SIDEBAR_FAVORITES) {
    return { error: `You can only favorite up to ${MAX_SIDEBAR_FAVORITES} sections` }
  }

  await prisma.sidebarFavorite.upsert({
    where: { userId_href: { userId: user.id, href } },
    create: { userId: user.id, href, label, color },
    update: { color },
  })

  revalidatePath('/', 'layout')
  return { success: true }
}

export async function removeFavorite(href: string) {
  const user = await requireAuth()
  await prisma.sidebarFavorite.deleteMany({ where: { userId: user.id, href } })
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function setFavoriteColor(href: string, color: FavoriteColor) {
  const user = await requireAuth()
  if (!FAVORITE_COLORS.includes(color)) return { error: 'Invalid color' }

  await prisma.sidebarFavorite.updateMany({
    where: { userId: user.id, href },
    data: { color },
  })
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function setFeaturedFavorite(href: string | null) {
  const user = await requireAuth()

  await prisma.$transaction(async (tx) => {
    await tx.sidebarFavorite.updateMany({
      where: { userId: user.id, isFeatured: true },
      data: { isFeatured: false },
    })
    if (href) {
      await tx.sidebarFavorite.updateMany({
        where: { userId: user.id, href },
        data: { isFeatured: true },
      })
    }
  })

  revalidatePath('/', 'layout')
  return { success: true }
}
