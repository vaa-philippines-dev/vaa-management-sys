'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath, revalidateTag } from 'next/cache'
import { CACHE_TAGS } from '@/lib/cache'
import {
  requireRole,
  getCurrentUser,
  isDepartmentUnrestricted,
  getManagedDepartmentIds,
  TEAM_MANAGE_ROLES,
} from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import type { ProjectStatus, ProjectPriority } from '@/src/generated/prisma/enums'

// Projects are a department's own initiatives, so the same tier that owns
// department composition owns them — TEAM_MANAGE_ROLES (Dept Manager, HR,
// admins). Ops Manager is deliberately included here even though it isn't in
// TEAM_MANAGE_ROLES: unlike team *leadership*, a proposal is raised by
// whoever runs the department day to day.
const PROJECT_MUTATOR_ROLES = [...TEAM_MANAGE_ROLES, 'OPERATIONS_MANAGER'] as const

async function assertDepartmentManaged(
  actor: Awaited<ReturnType<typeof getCurrentUser>>,
  departmentId: string
) {
  if (!actor || isDepartmentUnrestricted(actor)) return
  const managedIds = getManagedDepartmentIds(actor)
  if (!managedIds.includes(departmentId)) {
    throw new Error('Forbidden: department not in your managed scope')
  }
}

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = (value as string | null)?.trim()
  if (!raw) return null
  const d = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

function readForm(formData: FormData) {
  return {
    name: ((formData.get('name') as string) ?? '').trim(),
    description: ((formData.get('description') as string) ?? '').trim() || null,
    status: (formData.get('status') as ProjectStatus) || 'FOR_REVIEW',
    priority: (formData.get('priority') as ProjectPriority) || 'NORMAL',
    proposedDate: parseDate(formData.get('proposedDate')),
    startDate: parseDate(formData.get('startDate')),
    completedDate: parseDate(formData.get('completedDate')),
    proposalFileName: ((formData.get('proposalFileName') as string) ?? '').trim() || null,
    proposalFileUrl: ((formData.get('proposalFileUrl') as string) ?? '').trim() || null,
    referenceNotes: ((formData.get('referenceNotes') as string) ?? '').trim() || null,
    remarks: ((formData.get('remarks') as string) ?? '').trim() || null,
    ownerId: ((formData.get('ownerId') as string) ?? '').trim() || null,
  }
}

function revalidateProjects() {
  revalidatePath('/projects')
  revalidateTag(CACHE_TAGS.projects, 'default')
}

export async function createProject(formData: FormData) {
  const actor = await requireRole(...PROJECT_MUTATOR_ROLES)

  const departmentId = ((formData.get('departmentId') as string) ?? '').trim()
  if (!departmentId) return { error: 'A department is required' }

  const input = readForm(formData)
  if (!input.name) return { error: 'Project name is required' }

  await assertDepartmentManaged(actor, departmentId)

  const project = await prisma.project.create({
    data: { ...input, departmentId, createdById: actor.id },
  })

  await logAudit({
    actorId: actor.id,
    action: 'CREATE',
    entityType: 'Project',
    entityId: project.id,
    after: { name: input.name, status: input.status, priority: input.priority },
    departmentId,
  })

  revalidateProjects()
  return { ok: true }
}

export async function updateProject(projectId: string, formData: FormData) {
  const actor = await requireRole(...PROJECT_MUTATOR_ROLES)

  const existing = await prisma.project.findUnique({ where: { id: projectId } })
  if (!existing) return { error: 'Project not found' }

  await assertDepartmentManaged(actor, existing.departmentId)

  const input = readForm(formData)
  if (!input.name) return { error: 'Project name is required' }

  const project = await prisma.project.update({ where: { id: projectId }, data: input })

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'Project',
    entityId: project.id,
    before: { name: existing.name, status: existing.status, priority: existing.priority },
    after: { name: input.name, status: input.status, priority: input.priority },
    departmentId: existing.departmentId,
  })

  revalidateProjects()
  return { ok: true }
}

export async function deleteProject(projectId: string) {
  const actor = await requireRole(...PROJECT_MUTATOR_ROLES)

  const existing = await prisma.project.findUnique({ where: { id: projectId } })
  if (!existing) return { error: 'Project not found' }

  await assertDepartmentManaged(actor, existing.departmentId)

  await prisma.project.delete({ where: { id: projectId } })

  await logAudit({
    actorId: actor.id,
    action: 'DELETE',
    entityType: 'Project',
    entityId: projectId,
    before: { name: existing.name, status: existing.status },
    departmentId: existing.departmentId,
  })

  revalidateProjects()
  return { ok: true }
}
