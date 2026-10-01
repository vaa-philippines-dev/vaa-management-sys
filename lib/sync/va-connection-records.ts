import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { fetchVAConnectionRows, type RawVAConnectionRow } from '@/lib/google/va-connections-sheet'

export type LoadSummary = {
  totalRows: number
  loaded: number
  /** Rows the sheet actually changed this run — the rest were left untouched. */
  changed: number
  skippedBlankId: number
  skippedDuplicate: number
}

const BATCH_SIZE = 200

const COLUMNS = [
  'connection_id',
  'status',
  'connection_type',
  'va_external_id',
  'va_name',
  'client_external_id',
  'client_name',
  'department',
  'service',
  'hours',
  'hours_type',
  'connection_date',
  'start_date',
  'termination_date',
  'notes',
  'raw',
  'last_synced_at',
] as const

function clean(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// The sheet hands back every column for every row, so most of `raw` is empty
// strings plus one blank-named column — 63% of the stored JSON by volume
// (6.8 MB of 4.8k rows, vs 2.6 MB once pruned). An absent key and a key set to
// "" mean the same thing to every reader of this mirror, so drop the latter.
function pruneRaw(row: RawVAConnectionRow): RawVAConnectionRow {
  const pruned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    if (!key) continue
    if (typeof value === 'string' && value.trim() === '') continue
    if (value === null || value === undefined) continue
    pruned[key] = value
  }
  return pruned as RawVAConnectionRow
}

type PreparedRow = {
  connectionId: string
  status: string
  connectionType: string | null
  vaExternalId: string | null
  vaName: string | null
  clientExternalId: string | null
  clientName: string | null
  department: string | null
  service: string | null
  hours: string | null
  hoursType: string | null
  connectionDate: string | null
  startDate: string | null
  terminationDate: string | null
  notes: string | null
  raw: RawVAConnectionRow
  lastSyncedAt: Date
}

function prepareRow(row: RawVAConnectionRow, connectionId: string, now: Date): PreparedRow {
  return {
    connectionId,
    status: clean(row.ConnectionStatus) ?? 'Unknown',
    connectionType: clean(row.ConnectionType),
    vaExternalId: clean(row.VAID),
    vaName: clean(row.VAName),
    clientExternalId: clean(row.ClientID),
    clientName: clean(row.CustomerName),
    department: clean(row.Department),
    service: clean(row.Service),
    hours: clean(row.Hours),
    hoursType: clean(row.HoursType),
    connectionDate: clean(row.VAConnectionDate),
    startDate: clean(row.ActualStartDate),
    terminationDate: clean(row.TerminationDate),
    notes: clean(row.Notes),
    raw: pruneRaw(row),
    lastSyncedAt: now,
  }
}

async function upsertBatch(batch: PreparedRow[]): Promise<number> {
  if (batch.length === 0) return 0

  const valuesSql: string[] = []
  const params: unknown[] = []

  batch.forEach((row) => {
    const values = [
      row.connectionId,
      row.status,
      row.connectionType,
      row.vaExternalId,
      row.vaName,
      row.clientExternalId,
      row.clientName,
      row.department,
      row.service,
      row.hours,
      row.hoursType,
      row.connectionDate,
      row.startDate,
      row.terminationDate,
      row.notes,
      JSON.stringify(row.raw),
      row.lastSyncedAt,
    ]

    const base = params.length
    const placeholders = COLUMNS.map((col, i) => {
      const n = base + i + 1
      if (col === 'raw') return `$${n}::jsonb`
      if (col === 'last_synced_at') return `$${n}::timestamp`
      return `$${n}`
    })
    valuesSql.push(`($${base + values.length + 1}, ${placeholders.join(', ')})`)
    params.push(...values, randomUUID())
  })

  // id goes last in each row's param list but first in the column order — reorder here
  // by building the SQL with id's placeholder computed from the tail param we just pushed.
  const sql = `
    INSERT INTO "va_connection_records" (id, ${COLUMNS.join(', ')})
    VALUES ${valuesSql.join(', ')}
    ON CONFLICT (connection_id) DO UPDATE SET
      status = EXCLUDED.status,
      connection_type = EXCLUDED.connection_type,
      va_external_id = EXCLUDED.va_external_id,
      va_name = EXCLUDED.va_name,
      client_external_id = EXCLUDED.client_external_id,
      client_name = EXCLUDED.client_name,
      department = EXCLUDED.department,
      service = EXCLUDED.service,
      hours = EXCLUDED.hours,
      hours_type = EXCLUDED.hours_type,
      connection_date = EXCLUDED.connection_date,
      start_date = EXCLUDED.start_date,
      termination_date = EXCLUDED.termination_date,
      notes = EXCLUDED.notes,
      raw = EXCLUDED.raw,
      last_synced_at = EXCLUDED.last_synced_at
    WHERE (
      "va_connection_records".status,
      "va_connection_records".connection_type,
      "va_connection_records".va_external_id,
      "va_connection_records".va_name,
      "va_connection_records".client_external_id,
      "va_connection_records".client_name,
      "va_connection_records".department,
      "va_connection_records".service,
      "va_connection_records".hours,
      "va_connection_records".hours_type,
      "va_connection_records".connection_date,
      "va_connection_records".start_date,
      "va_connection_records".termination_date,
      "va_connection_records".notes,
      "va_connection_records".raw
    ) IS DISTINCT FROM (
      EXCLUDED.status,
      EXCLUDED.connection_type,
      EXCLUDED.va_external_id,
      EXCLUDED.va_name,
      EXCLUDED.client_external_id,
      EXCLUDED.client_name,
      EXCLUDED.department,
      EXCLUDED.service,
      EXCLUDED.hours,
      EXCLUDED.hours_type,
      EXCLUDED.connection_date,
      EXCLUDED.start_date,
      EXCLUDED.termination_date,
      EXCLUDED.notes,
      EXCLUDED.raw
    )
  `
  return prisma.$executeRawUnsafe(sql, ...params)
}

// Mirrors every VAConnections sheet row as-is, regardless of whether its VA/Client
// can be resolved to a real record in this app — that resolution ("connect" phase)
// is a separate, not-yet-built step. This just makes the sheet's data visible.
// Batched as multi-row INSERT ... ON CONFLICT rather than per-row upserts — with
// several thousand rows, one round trip per row was taking minutes.
//
// The ON CONFLICT ... DO UPDATE is guarded by a WHERE that compares every
// content column, so a row whose sheet values haven't moved is left alone
// instead of rewritten. Almost all of these connections are historical and
// never change again: without the guard each nightly run replaced all ~4.8k
// rows, and since Postgres updates are copy-on-write that churned ~8 MB of
// dead tuples a day, holding the table at roughly twice its live size.
// `lastSyncedAt` therefore means "when this row last changed in the sheet",
// not "when the cron last ran" — the run itself is reported by this summary.
export async function loadVAConnectionRecords(): Promise<LoadSummary> {
  const rows = await fetchVAConnectionRows()

  const summary: LoadSummary = {
    totalRows: rows.length,
    loaded: 0,
    changed: 0,
    skippedBlankId: 0,
    skippedDuplicate: 0,
  }

  const seen = new Set<string>()
  const now = new Date()
  let batch: PreparedRow[] = []
  let changed = 0

  for (const row of rows) {
    const connectionId = row.ConnectionID?.trim()
    if (!connectionId) {
      summary.skippedBlankId++
      continue
    }
    if (seen.has(connectionId)) {
      summary.skippedDuplicate++
      continue
    }
    seen.add(connectionId)

    batch.push(prepareRow(row, connectionId, now))
    summary.loaded++

    if (batch.length >= BATCH_SIZE) {
      changed += await upsertBatch(batch)
      batch = []
    }
  }
  changed += await upsertBatch(batch)
  summary.changed = changed

  return summary
}
