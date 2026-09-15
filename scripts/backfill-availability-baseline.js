// One-off baseline for phase ZR. The availability review clock is a brand
// new field: before it existed nobody had ever "confirmed" an availability
// record in-app, so every VA with hours on file would flag "Never updated"
// the moment the page shipped (836 of them on live data) — a backlog nobody
// actually created, which buries the rows that later go genuinely stale.
//
// Stamping the migration date as the baseline starts the clock from today,
// so the Needs-review filter is empty on day one and becomes meaningful as
// records age past the review window. It is explicitly NOT a claim that
// anyone reviewed these records — a manager re-confirming a row overwrites
// this with a real timestamp.
//
// Idempotent: only touches rows that still have no baseline.
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const REVIEW_DAYS = 30

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const res = await pool.query(
      `UPDATE va_profiles
          SET availability_changed_at = NOW(),
              availability_review_due_at = NOW() + ($1 || ' days')::interval
        WHERE availability_changed_at IS NULL
          AND preferred_work_hours IS NOT NULL`,
      [REVIEW_DAYS]
    )
    console.log(`Baseline set on ${res.rowCount} VA profile(s)`)
  } catch (e) {
    console.error('Backfill error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
