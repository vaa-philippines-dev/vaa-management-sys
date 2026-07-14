require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const sql = fs.readFileSync('prisma/migrations/phase_v_teams.sql', 'utf8')
    console.log('Running Phase V migration...')
    await pool.query(sql)
    console.log('Migration complete — teams and team_memberships tables created')
  } catch (e) {
    console.error('Migration error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
