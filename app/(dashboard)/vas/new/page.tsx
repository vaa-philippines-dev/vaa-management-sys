import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { VAForm } from '@/components/vas/VAForm'

const VA_CREATE_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'DEPT_MANAGER', 'TEAM_LEADER', 'OPERATIONS_MANAGER']

export default async function NewVAPage() {
  const currentUser = await getCurrentUser()
  if (!currentUser || !VA_CREATE_ROLES.includes(currentUser.systemRole)) {
    redirect('/dashboard')
  }

  const skills = await prisma.skill.findMany({ orderBy: { name: 'asc' } })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New VA</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Add a new virtual assistant and their skills
        </p>
      </div>
      <VAForm skills={skills.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  )
}