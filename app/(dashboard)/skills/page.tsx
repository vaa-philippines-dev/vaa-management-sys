import { prisma } from '@/lib/prisma'
import { getCurrentUser, canMutate } from '@/lib/auth'
import { cached, CACHE_TAGS } from '@/lib/cache'
import { redirect } from 'next/navigation'
import { SkillManager } from '@/components/skills/SkillManager'

export default async function SkillsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  const canEdit = canMutate(user)

  const [skills, departments, deptSkills] = await Promise.all([
    cached('skills:list', [CACHE_TAGS.skills], 3600, () =>
      prisma.skill.findMany({
        include: {
          _count: { select: { vaSkills: true, departments: true } },
          departments: { include: { department: { select: { id: true, name: true } } } },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
      })
    ),
    cached('skills:depts', [CACHE_TAGS.departments], 600, () =>
      prisma.department.findMany({
        where: { status: 'ACTIVE', level: 'SERVICE', parentId: { not: null } },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true },
      })
    ),
    cached('skills:deptSkills', [CACHE_TAGS.departments, CACHE_TAGS.skills], 60, () =>
      prisma.departmentSkill.findMany({ include: { department: { select: { id: true, name: true } } } })
    ),
  ])

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Services & Skills</h2>
          <p className="text-xs text-muted-foreground">
            Skill tags assigned to VAs. Link services to departments for categorization.
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
          isActive: s.isActive,
          vaCount: s._count.vaSkills,
          departmentNames: s.departments.map((d) => d.department.name),
        }))}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        deptSkills={deptSkills}
      />
    </div>
  )
}
