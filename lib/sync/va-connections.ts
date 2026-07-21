import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { fetchVAConnectionRows, type RawVAConnectionRow } from '@/lib/google/va-connections-sheet'

// Well-known actor for audit-log entries written by unattended sync runs.
// isActive: false keeps it out of assignable-user dropdowns while still
// satisfying AuditLog.actorId's FK requirement.
const SYSTEM_ACTOR_EMAIL = 'sync-va-connections@system.internal'

const SKIPPED_STATUSES = new Set(['Pending', 'Accepted', 'Declined'])

// The manager's CMS statuses don't map 1:1 onto AssignmentStatus. "Terminated"
// has no clean equivalent (could be a natural end or an early stop) so it's
// treated as CANCELLED — the more conservative reading. Revisit if that turns
// out to be wrong in practice.
const STATUS_MAP: Record<string, 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'CANCELLED'> = {
  Started: 'ACTIVE',
  Paused: 'PAUSED', // not in the sheet's documented enum, but appears in live data
  Cancelled: 'CANCELLED',
  Terminated: 'CANCELLED',
}

const TYPE_MAP: Record<string, 'REGULAR' | 'PROJECT'> = {
  Regular: 'REGULAR',
  'Project Based': 'PROJECT',
}

export type SyncSummary = {
  totalRows: number
  created: number
  updated: number
  skippedStatus: number
  skippedDuplicate: number
  skippedUnmappedVA: number
  skippedUnmappedClient: number
  skippedInvalid: number
  errors: { connectionId: string; message: string }[]
}

function parseHours(raw: string): number | null {
  if (!raw) return null
  const direct = Number(raw)
  if (Number.isFinite(direct) && direct > 0) return direct

  // Defensive fallback for freeform values like "3H a day" or "4 hours a week"
  const match = raw.match(/(\d+(\.\d+)?)/)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n > 0 ? n : null
}

function parseDate(raw: string): Date | null {
  if (!raw) return null
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? null : d
}

async function getSystemActorId(): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: SYSTEM_ACTOR_EMAIL },
    update: {},
    create: {
      email: SYSTEM_ACTOR_EMAIL,
      firstName: 'VAConnections',
      lastName: 'Sync',
      systemRole: 'SYSTEM_ADMIN',
      userType: 'INTERNAL_STAFF',
      isActive: false,
    },
  })
  return user.id
}

// externalId -> internalId, keyed "entityType:externalId" so one map covers both entity types.
async function loadMappingIndex(): Promise<Map<string, string>> {
  const mappings = await prisma.externalSyncMapping.findMany({
    where: { source: 'va_connections_sheet' },
    select: { entityType: true, externalId: true, internalId: true },
  })
  return new Map(mappings.map((m) => [`${m.entityType}:${m.externalId}`, m.internalId]))
}

type ExistingAssignment = {
  id: string
  status: string
  agreedHours: unknown
  endDate: Date | null
}

async function loadExistingByExternalId(): Promise<Map<string, ExistingAssignment>> {
  const existing = await prisma.assignment.findMany({
    where: { source: 'VA_CONNECTIONS_SYNC', externalId: { not: null } },
    select: { id: true, externalId: true, status: true, agreedHours: true, endDate: true },
  })
  return new Map(existing.filter((a) => a.externalId).map((a) => [a.externalId as string, a]))
}

export async function syncVAConnections(): Promise<SyncSummary> {
  const summary: SyncSummary = {
    totalRows: 0,
    created: 0,
    updated: 0,
    skippedStatus: 0,
    skippedDuplicate: 0,
    skippedUnmappedVA: 0,
    skippedUnmappedClient: 0,
    skippedInvalid: 0,
    errors: [],
  }

  const [rows, actorId, mappingIndex, existingByExternalId] = await Promise.all([
    fetchVAConnectionRows(),
    getSystemActorId(),
    loadMappingIndex(),
    loadExistingByExternalId(),
  ])
  summary.totalRows = rows.length

  const seenConnectionIds = new Set<string>()

  for (const row of rows) {
    const result = await syncRow(row, actorId, seenConnectionIds, mappingIndex, existingByExternalId)
    switch (result) {
      case 'created':
        summary.created++
        break
      case 'updated':
        summary.updated++
        break
      case 'skipped_status':
        summary.skippedStatus++
        break
      case 'skipped_duplicate':
        summary.skippedDuplicate++
        break
      case 'skipped_unmapped_va':
        summary.skippedUnmappedVA++
        break
      case 'skipped_unmapped_client':
        summary.skippedUnmappedClient++
        break
      case 'skipped_invalid':
        summary.skippedInvalid++
        break
      default:
        summary.errors.push({ connectionId: row.ConnectionID || '(blank)', message: result.message })
    }
  }

  return summary
}

type RowResult =
  | 'created'
  | 'updated'
  | 'skipped_status'
  | 'skipped_duplicate'
  | 'skipped_unmapped_va'
  | 'skipped_unmapped_client'
  | 'skipped_invalid'
  | { message: string }

async function syncRow(
  row: RawVAConnectionRow,
  actorId: string,
  seenConnectionIds: Set<string>,
  mappingIndex: Map<string, string>,
  existingByExternalId: Map<string, ExistingAssignment>,
): Promise<RowResult> {
  const connectionId = row.ConnectionID?.trim()
  if (!connectionId) return 'skipped_invalid'

  if (seenConnectionIds.has(connectionId)) return 'skipped_duplicate'
  seenConnectionIds.add(connectionId)

  const status = row.ConnectionStatus?.trim()
  if (SKIPPED_STATUSES.has(status)) return 'skipped_status'

  const mappedStatus = STATUS_MAP[status]
  if (!mappedStatus) return 'skipped_invalid'

  const mappedType = TYPE_MAP[row.ConnectionType?.trim()] ?? 'REGULAR'

  const hours = parseHours(row.Hours)
  const startDate = parseDate(row.ActualStartDate) ?? parseDate(row.VAConnectionDate)
  if (!hours || !startDate) return 'skipped_invalid'

  const endDate = parseDate(row.TerminationDate)

  const vaProfileId = mappingIndex.get(`VA_PROFILE:${row.VAID?.trim()}`)
  if (!vaProfileId) return 'skipped_unmapped_va'

  const clientId = mappingIndex.get(`CLIENT:${row.ClientID?.trim()}`)
  if (!clientId) return 'skipped_unmapped_client'

  try {
    const existing = existingByExternalId.get(connectionId)

    const data = {
      type: mappedType,
      status: mappedStatus,
      agreedHours: hours,
      startDate,
      endDate,
      notes: row.Notes?.trim() || null,
      source: 'VA_CONNECTIONS_SYNC' as const,
      externalId: connectionId,
      syncedAt: new Date(),
      vaProfileId,
      clientId,
    }

    if (existing) {
      await prisma.assignment.update({ where: { id: existing.id }, data })
      await logAudit({
        actorId,
        action: 'UPDATE',
        entityType: 'Assignment',
        entityId: existing.id,
        before: {
          status: existing.status,
          agreedHours: existing.agreedHours?.toString(),
          endDate: existing.endDate?.toISOString() ?? null,
        },
        after: { status: data.status, agreedHours: data.agreedHours, endDate: data.endDate?.toISOString() ?? null },
        metadata: { source: 'va_connections_sheet', connectionId },
      })
      return 'updated'
    }

    const created = await prisma.assignment.create({ data })
    await logAudit({
      actorId,
      action: 'CREATE',
      entityType: 'Assignment',
      entityId: created.id,
      after: { vaProfileId, clientId, type: data.type, status: data.status, agreedHours: data.agreedHours },
      metadata: { source: 'va_connections_sheet', connectionId },
    })
    return 'created'
  } catch (error) {
    return { message: error instanceof Error ? error.message : String(error) }
  }
}
