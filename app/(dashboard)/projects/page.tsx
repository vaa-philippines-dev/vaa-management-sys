import { prisma } from '@/lib/prisma'
import {
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  TEAM_MANAGE_ROLES,
} from '@/lib/auth'
import { redirect } from 'next/navigation'
import { LEVEL_RECORD_NAMES } from '@/lib/departments'
import { ProjectsBoard } from '@/components/projects/ProjectsBoard'
import { FolderKanban } from 'lucide-react'

// The DMF sheet's "Projects/Proposals" tab. Department-scoped for everyone
// except admins/HR (isDepartmentUnrestricted), matching how Teams and the
// department dashboard already split "sees everything" from "sees mine".
export default async function ProjectsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  if (user.userType === 'VIRTUAL_ASSISTANT') redirect('/dashboard')

  const unrestricted = isDepartmentUnrestricted(user)
  const managedIds = getManagedDepartmentIds(user)
  const canMutate = [...TEAM_MANAGE_ROLES, 'OPERATIONS_MANAGER'].includes(user.systemRole)

  const [projects, departments, owners] = await Promise.all([
    prisma.project.findMany({
      where: unrestricted ? {} : { departmentId: { in: managedIds } },
      include: {
        department: { select: { id: true, name: true } },
        owner: { select: { id: true, firstName: true, lastName: true } },
      },
      // Newest proposal first, with rows that never got a DATE in the sheet
      // sorted last rather than jumping to the top as nulls otherwise would.
      orderBy: [{ proposedDate: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
    }),
    prisma.department.findMany({
      // The three protected "Level records" (Executive/Management/Service)
      // anchor the tree and are never assignable targets — same exclusion
      // every other department picker in the app applies.
      where: {
        status: 'ACTIVE',
        parentId: { not: null },
        name: { notIn: LEVEL_RECORD_NAMES },
        ...(unrestricted ? {} : { id: { in: managedIds } }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        userType: { not: 'VIRTUAL_ASSISTANT' },
        ...(unrestricted
          ? {}
          : { memberships: { some: { departmentId: { in: managedIds }, endedAt: null } } }),
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <FolderKanban className="h-6 w-6" />
          Projects
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Department programs, proposals and initiatives
          {unrestricted ? ' across every department' : ''}.
        </p>
      </div>

      <ProjectsBoard
        canMutate={canMutate}
        showDepartment={unrestricted || managedIds.length > 1}
        departments={departments}
        owners={owners.map((o) => ({ id: o.id, name: `${o.firstName} ${o.lastName}`.trim() }))}
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          description: p.description,
          status: p.status,
          priority: p.priority,
          proposedDate: p.proposedDate?.toISOString() ?? null,
          startDate: p.startDate?.toISOString() ?? null,
          completedDate: p.completedDate?.toISOString() ?? null,
          proposalFileName: p.proposalFileName,
          proposalFileUrl: p.proposalFileUrl,
          referenceNotes: p.referenceNotes,
          remarks: p.remarks,
          departmentId: p.departmentId,
          departmentName: p.department.name,
          ownerId: p.owner?.id ?? null,
          ownerName: p.owner ? `${p.owner.firstName} ${p.owner.lastName}`.trim() : null,
        }))}
      />
    </div>
  )
}
