import { prisma } from '@/lib/prisma'

type AuditEntry = {
  actorId: string
  action: string
  entityType: string
  entityId: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  metadata?: Record<string, unknown>
  departmentId?: string | null
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  const { actorId, action, entityType, entityId, before, after, metadata, departmentId } = entry

  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        action: action as any,
        entityType,
        entityId,
        oldValues: before ? (before as any) : undefined,
        newValues: after ? (after as any) : undefined,
        metadata: metadata ? (metadata as any) : undefined,
        departmentId: departmentId ?? null,
      },
    })
  } catch (error) {
    console.error('[AuditLog] Failed to write audit log:', error)
  }
}

export async function logAuditWrite(entries: AuditEntry[]): Promise<void> {
  try {
    await prisma.auditLog.createMany({
      data: entries.map((e) => ({
        actorId: e.actorId,
        action: e.action as any,
        entityType: e.entityType,
        entityId: e.entityId,
        oldValues: e.before ? (e.before as any) : undefined,
        newValues: e.after ? (e.after as any) : undefined,
        metadata: e.metadata ? (e.metadata as any) : undefined,
        departmentId: e.departmentId ?? null,
      })),
    })
  } catch (error) {
    console.error('[AuditLog] Failed to write batch audit logs:', error)
  }
}
