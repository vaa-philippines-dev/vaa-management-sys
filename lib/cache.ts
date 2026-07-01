import { unstable_cache } from 'next/cache'

export const CACHE_TAGS = {
  users: 'users',
  departments: 'departments',
  vas: 'vas',
  clients: 'clients',
  assignments: 'assignments',
  worklogs: 'worklogs',
  skills: 'skills',
  dashboard: 'dashboard',
  admin: 'admin',
  reports: 'reports',
  audit: 'audit',
} as const

export function cached<T>(
  key: string,
  tags: string[],
  ttlSeconds: number,
  fn: () => Promise<T>,
): Promise<T> {
  return unstable_cache(fn, [key], { tags, revalidate: ttlSeconds })()
}
