import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LoginForm } from '@/components/auth/LoginForm'
import { prisma } from '@/lib/prisma'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  // For the "Request an account" form. Names only — nothing sensitive — and
  // the same exclusion of the three Level records every department picker uses.
  const departments = await prisma.department
    .findMany({
      where: { status: 'ACTIVE', parentId: { not: null }, name: { notIn: LEVEL_RECORD_NAMES } },
      select: { name: true },
      orderBy: { name: 'asc' },
    })
    .catch(() => [])
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-12">
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
        <ThemeToggle />
      </div>

      <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 480,
            height: 480,
            background: 'radial-gradient(circle, rgba(128,128,128,0.16) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            width: 320,
            height: 320,
            transform: 'translate(120px, -80px)',
            background: 'radial-gradient(circle, rgba(128,128,128,0.12) 0%, transparent 70%)',
          }}
        />
      </div>

      <LoginForm
        className="animate-in fade-in-0 zoom-in-95 duration-300"
        next={next}
        departments={departments.map((d) => d.name)}
      />
    </div>
  )
}
