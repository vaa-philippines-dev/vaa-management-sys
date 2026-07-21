import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { fetchVAConnectionRows, type RawVAConnectionRow } from '@/lib/google/va-connections-sheet'

export type LoadSummary = {
  totalRows: number
  loaded: number
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
    raw: row,
    lastSyncedAt: now,
  }
}

async function upsertBatch(batch: PreparedRow[]): Promise<void> {
  if (batch.length === 0) return

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
  `
  await prisma.$executeRawUnsafe(sql, ...params)
}

// Mirrors every VAConnections sheet row as-is, regardless of whether its VA/Client
// can be resolved to a real record in this app — that resolution ("connect" phase)
// is a separate, not-yet-built step. This just makes the sheet's data visible.
// Batched as multi-row INSERT ... ON CONFLICT rather than per-row upserts — with
// several thousand rows, one round trip per row was taking minutes.
export async function loadVAConnectionRecords(): Promise<LoadSummary> {
  const rows = await fetchVAConnectionRows()

  const summary: LoadSummary = {
    totalRows: rows.length,
    loaded: 0,
    skippedBlankId: 0,
    skippedDuplicate: 0,
  }

  const seen = new Set<string>()
  const now = new Date()
  let batch: PreparedRow[] = []

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
      await upsertBatch(batch)
      batch = []
    }
  }
  await upsertBatch(batch)

  return summary
}
