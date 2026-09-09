// One-off backfill for phase_zo_assignment_kpi_checks.sql: seeds the 7 fixed
// KPI checkpoints (Day 4/Week 1/Week 2/Month 1/2/3/6) for every Assignment
// that predates this migration. New assignments get theirs from
// createAssignment() in app/(dashboard)/assignments/actions.ts — this script
// only needs to run once, after the migration, to cover existing rows.
require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const { randomUUID } = require('crypto')

// Mirrors lib/kpi-checks.ts's computeKpiCheckpoints() exactly — kept in sync
// by hand since this one-off script runs outside the app's module graph.
function addWorkdays(start, days) {
  let d = new Date(start)
  let added = 0
  while (added < days) {
    d = new Date(d.getTime() + 86400000)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function addCalendarMonthsSkipWeekend(start, months) {
  const d = new Date(start)
  d.setMonth(d.getMonth() + months)
  const dow = d.getDay()
  if (dow === 6) return new Date(d.getTime() + 2 * 86400000)
  if (dow === 0) return new Date(d.getTime() + 86400000)
  return d
}

function computeKpiCheckpoints(startDate) {
  return [
    { milestone: 'D4', dueDate: addWorkdays(startDate, 3) },
    { milestone: 'W1', dueDate: new Date(startDate.getTime() + 7 * 86400000) },
    { milestone: 'W2', dueDate: new Date(startDate.getTime() + 14 * 86400000) },
    { milestone: 'M1', dueDate: addCalendarMonthsSkipWeekend(startDate, 1) },
    { milestone: 'M2', dueDate: addCalendarMonthsSkipWeekend(startDate, 2) },
    { milestone: 'M3', dueDate: addCalendarMonthsSkipWeekend(startDate, 3) },
    { milestone: 'M6', dueDate: addCalendarMonthsSkipWeekend(startDate, 6) },
  ]
}

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const { rows: assignments } = await pool.query(`
      SELECT a.id, a.start_date
      FROM assignments a
      LEFT JOIN assignment_kpi_checks k ON k.assignment_id = a.id
      WHERE k.id IS NULL
      GROUP BY a.id, a.start_date
    `)

    console.log(`Backfilling KPI checkpoints for ${assignments.length} assignment(s)...`)

    let created = 0
    for (const a of assignments) {
      const checkpoints = computeKpiCheckpoints(new Date(a.start_date))
      for (const { milestone, dueDate } of checkpoints) {
        await pool.query(
          `INSERT INTO assignment_kpi_checks (id, assignment_id, milestone, due_date, completed, created_at, updated_at)
           VALUES ($1, $2, $3, $4, false, now(), now())
           ON CONFLICT (assignment_id, milestone) DO NOTHING`,
          [randomUUID(), a.id, milestone, dueDate]
        )
        created++
      }
    }

    console.log(`Done — created ${created} checkpoint rows across ${assignments.length} assignment(s).`)
  } catch (e) {
    console.error('Backfill error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
