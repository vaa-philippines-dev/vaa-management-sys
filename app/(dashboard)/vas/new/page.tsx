import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { VAForm } from '@/components/vas/VAForm'

export default async function NewVAPage() {
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