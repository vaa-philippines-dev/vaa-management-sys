require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    console.log('Running Phase ZK0 (TicketCategory.TERMINATION)...')
    await pool.query(fs.readFileSync('prisma/migrations/phase_zk0_ticket_category_termination.sql', 'utf8'))

    console.log('Running Phase ZK (termination workflow tables)...')
    await pool.query(fs.readFileSync('prisma/migrations/phase_zk_termination_workflow.sql', 'utf8'))

    console.log('Migration complete — terminations, exit_survey_invites, exit_survey_responses, exit_clearances tables added')
  } catch (e) {
    console.error('Migration error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
