/**
 * Supabase storage maintenance — reports what the database is spending its
 * bytes on and, with --apply, reclaims the recoverable ones.
 *
 * Dry run by default (prints a report, writes nothing):
 *   npm run db:maintenance
 *   npm run db:maintenance -- --apply
 *
 * Tasks (each opt-out-able with --skip-<name>):
 *   prune-raw  Rewrites va_connection_records.raw without its empty-valued
 *              columns, matching what lib/sync/va-connection-records.ts now
 *              stores. One-off catch-up for rows loaded before that change.
 *   audit      Deletes audit_logs older than --audit-days. Does nothing unless
 *              that flag is passed, because this is the compliance trail and
 *              how long to keep it is a policy call, not a default.
 *   vacuum     VACUUM (FULL, ANALYZE) on tables holding materially more heap
 *              than live data. Plain VACUUM returns dead tuples to the table's
 *              own free space map but never to the filesystem, so a table that
 *              was rewritten daily stays large on the Supabase size meter even
 *              with zero dead tuples. FULL rewrites it compactly.
 *
 * VACUUM FULL takes an ACCESS EXCLUSIVE lock — reads and writes to that table
 * block until it finishes. At this database's size that is seconds, but run it
 * off-peak, and never against a table mid-sync.
 */
import * as dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local' })

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const skip = (name: string) => args.includes(`--skip-${name}`)

function readAuditDays(): number | null {
  const i = args.findIndex((a) => a === '--audit-days' || a.startsWith('--audit-days='))
  if (i === -1) return null
  const raw = args[i].includes('=') ? args[i].split('=')[1] : args[i + 1]
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
const auditDays = readAuditDays()

// VACUUM FULL can't run inside a transaction block and needs a session-level
// connection, so this uses DIRECT_URL like prisma.config.ts does rather than
// the PgBouncer-pooled DATABASE_URL.
const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) {
  console.error('Set DIRECT_URL (preferred) or DATABASE_URL in .env.local')
  process.exit(1)
}

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// The pruned form of a raw sheet row: no blank-named column, no empty-string
// or null values. Kept as one expression so the report, the UPDATE and its
// WHERE all agree on what "already pruned" means.
const PRUNED_RAW = `(
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(raw::jsonb) as e(k, v)
  where k <> '' and v <> '""'::jsonb and v <> 'null'::jsonb
)`

async function main() {
  const db = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
  await db.connect()

  const before = await db.query<{ bytes: string }>(
    `select pg_database_size(current_database()) as bytes`,
  )
  console.log(`\nDatabase size: ${mb(Number(before.rows[0].bytes))}`)
  console.log(apply ? 'Mode: APPLY (writing)\n' : 'Mode: DRY RUN (use --apply to write)\n')

  // ── Largest tables ────────────────────────────────────────────────────
  const tables = await db.query<{ tbl: string; total: string; heap: string }>(`
    select c.relname as tbl,
           pg_total_relation_size(c.oid)::text as total,
           pg_relation_size(c.oid)::text as heap
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind = 'r' and n.nspname = 'public'
    order by pg_total_relation_size(c.oid) desc
    limit 10
  `)
  console.log('Largest tables:')
  for (const t of tables.rows) {
    console.log(
      `  ${t.tbl.padEnd(28)} ${mb(Number(t.total)).padStart(9)} total  ${mb(Number(t.heap)).padStart(9)} heap`,
    )
  }

  // ── prune-raw ─────────────────────────────────────────────────────────
  if (!skip('prune-raw')) {
    const { rows } = await db.query<{ stale: string; now_bytes: string; pruned_bytes: string }>(`
      select
        count(*) filter (where raw::jsonb <> ${PRUNED_RAW})::text as stale,
        coalesce(sum(pg_column_size(raw)), 0)::text as now_bytes,
        coalesce(sum(pg_column_size(${PRUNED_RAW})), 0)::text as pruned_bytes
      from va_connection_records
    `)
    const { stale, now_bytes, pruned_bytes } = rows[0]
    console.log(`\nprune-raw: ${stale} row(s) still hold empty-valued sheet columns`)
    console.log(
      `  raw column ${mb(Number(now_bytes))} -> ${mb(Number(pruned_bytes))} ` +
        `(saves ${mb(Number(now_bytes) - Number(pruned_bytes))})`,
    )

    if (apply && Number(stale) > 0) {
      const res = await db.query(`
        update va_connection_records
        set raw = ${PRUNED_RAW}
        where raw::jsonb <> ${PRUNED_RAW}
      `)
      console.log(`  rewrote ${res.rowCount} row(s)`)
    }
  }

  // ── audit retention ───────────────────────────────────────────────────
  if (!skip('audit')) {
    const dist = await db.query<{ month: string; n: string; bytes: string }>(`
      select to_char(date_trunc('month', created_at), 'YYYY-MM') as month,
             count(*)::text as n,
             sum(pg_column_size(t.*))::text as bytes
      from audit_logs t group by 1 order by 1
    `)
    console.log('\naudit_logs by month:')
    for (const r of dist.rows) {
      console.log(`  ${r.month}  ${r.n.padStart(7)} rows  ${mb(Number(r.bytes)).padStart(9)}`)
    }

    if (auditDays) {
      const { rows } = await db.query<{ n: string; bytes: string }>(
        `select count(*)::text as n, coalesce(sum(pg_column_size(t.*)), 0)::text as bytes
         from audit_logs t where created_at < now() - ($1 || ' days')::interval`,
        [String(auditDays)],
      )
      console.log(
        `  older than ${auditDays} days: ${rows[0].n} rows, ${mb(Number(rows[0].bytes))} (plus index space)`,
      )
      if (apply && Number(rows[0].n) > 0) {
        const res = await db.query(
          `delete from audit_logs where created_at < now() - ($1 || ' days')::interval`,
          [String(auditDays)],
        )
        console.log(`  deleted ${res.rowCount} row(s)`)
      }
    } else {
      console.log('  (pass --audit-days <n> to prune; no default, this is the compliance trail)')
    }
  }

  // ── vacuum ────────────────────────────────────────────────────────────
  if (!skip('vacuum')) {
    // pg_relation_size is what the table occupies on disk; summing
    // pg_column_size over live rows approximates what it actually needs. A
    // wide gap is space only VACUUM FULL gives back.
    const candidates: { tbl: string; heap: number; live: number }[] = []
    for (const t of tables.rows) {
      const heap = Number(t.heap)
      if (heap < 1024 * 1024) continue
      const { rows } = await db.query<{ live: string }>(
        `select coalesce(sum(pg_column_size(t.*)), 0)::text as live from "${t.tbl}" t`,
      )
      const live = Number(rows[0].live)
      if (heap > live * 1.5) candidates.push({ tbl: t.tbl, heap, live })
    }

    console.log('\nvacuum candidates (heap much larger than live data):')
    if (candidates.length === 0) console.log('  none')
    for (const c of candidates) {
      console.log(
        `  ${c.tbl.padEnd(28)} heap ${mb(c.heap).padStart(9)}  live ${mb(c.live).padStart(9)}` +
          `  reclaimable ~${mb(c.heap - c.live)}`,
      )
    }

    if (apply) {
      for (const c of candidates) {
        process.stdout.write(`  VACUUM (FULL, ANALYZE) ${c.tbl} ... `)
        await db.query(`VACUUM (FULL, ANALYZE) "${c.tbl}"`)
        console.log('done')
      }
    }
  }

  const after = await db.query<{ bytes: string }>(
    `select pg_database_size(current_database()) as bytes`,
  )
  console.log(`\nDatabase size: ${mb(Number(before.rows[0].bytes))} -> ${mb(Number(after.rows[0].bytes))}`)
  if (!apply) console.log('(unchanged — dry run)')

  await db.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
