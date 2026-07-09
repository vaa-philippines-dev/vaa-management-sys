require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const sql = fs.readFileSync('prisma/migrations/phase_i_general_status_overhaul.sql', 'utf8')
    console.log('Running Phase I migration...')
    await pool.query(sql)
    console.log('Migration complete — GeneralStatus replaced with ACTIVE/PENDING/TRANSFERRED/RESIGNED/REMOVED/PROJECT_ENDED/CANCELLED, onHold split into a boolean')
  } catch (e) {
    console.error('Migration error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
