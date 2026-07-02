import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { SkillManager } from '@/components/skills/SkillManager'

export default async function SkillsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const canEdit = canMutate(user)

  const skills = await cached('skills:list', [CACHE_TAGS.skills], 3600, () =>
    prisma.skill.findMany({
      include: {
        _count: { select: { vaSkills: true, departments: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })
  )

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Services</h2>
          <p className="text-xs text-muted-foreground">
            Manage the services VAs provide to clients. Each service can be linked to specific departments.
          </p>
        </div>
        {!canEdit && (
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded bg-amber-500/10 text-amber-700 border border-amber-500/20">
            View Only
          </span>
        )}
      </div>

      <SkillManager
        canEdit={canEdit}
        skills={skills.map((s) => ({
          id: s.id,
          name: s.name,
          shortName: s.shortName,
          acronym: s.acronym,
          category: s.category,
          jobDescription: s.jobDescription,
          attachmentUrl: s.attachmentUrl,
          isActive: s.isActive,
          vaCount: s._count.vaSkills,
          departmentCount: s._count.departments,
        }))}
      />
    </div>
  )
}
