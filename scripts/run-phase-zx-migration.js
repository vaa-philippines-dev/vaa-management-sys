require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const sql = fs.readFileSync('prisma/migrations/phase_zx_prep_status_buffers_availability.sql', 'utf8')
    console.log('Running Phase ZX migration...')
    await pool.query(sql)
    console.log('Migration complete — client_status nullable (+CANCELLED), preparation buffers table, 3 new availability values')
  } catch (e) {
    console.error('Migration error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
