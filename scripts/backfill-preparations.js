// One-off backfill for phase ZQ: every Assignment that predates the
// assignment_preparations table needs its (empty) Preparation row, same as
// createAssignment() now opens one on creation. Idempotent — skips any
// assignment that already has one, so it's safe to re-run.
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const { randomUUID } = require('crypto')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const { rows } = await pool.query(`
      SELECT a.id, a.start_date, a.status, a.end_date
      FROM assignments a
      LEFT JOIN assignment_preparations p ON p.assignment_id = a.id
      WHERE p.id IS NULL
    `)
    console.log(`Assignments without a preparation row: ${rows.length}`)

    let created = 0
    for (const a of rows) {
      // An assignment already past its start date self-evidently started;
      // grading it on-time vs delayed needs a target date the sheet has and
      // this app does not, so anything live is seeded STARTED_ON_TIME and a
      // manager corrects the exceptions. Terminal assignments carry their
      // end date into the EOC block so the data-quality check stays quiet.
      const started = a.start_date && new Date(a.start_date) <= new Date()
      const ended = a.status === 'COMPLETED' || a.status === 'CANCELLED'
      await pool.query(
        `INSERT INTO assignment_preparations
           (id, assignment_id, start_status, target_start_date, client_status, effectivity_date, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())`,
        [
          `cbf${randomUUID().replace(/-/g, '').slice(0, 22)}`,
          a.id,
          started ? 'STARTED_ON_TIME' : 'NOT_YET_STARTED',
          a.start_date,
          ended ? 'END_OF_WORK' : 'ACTIVE',
          ended ? a.end_date : null,
        ]
      )
      created++
    }
    console.log(`Backfill complete — ${created} preparation row(s) created`)
  } catch (e) {
    console.error('Backfill error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
