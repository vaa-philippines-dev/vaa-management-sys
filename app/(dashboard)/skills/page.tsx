import { prisma } from '@/lib/prisma'
import { SkillManager } from '@/components/skills/SkillManager'

export default async function SkillsPage() {
  const skills = await prisma.skill.findMany({
    include: { _count: { select: { vas: true } } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">VA Services</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Services offered by VAA Philippines — used to match VAs to e-commerce clients
        </p>
      </div>
      <SkillManager
        skills={skills.map((s) => ({
          id: s.id,
          name: s.name,
          category: s.category,
          vaCount: s._count.vas,
        }))}
      />
    </div>
  )
}