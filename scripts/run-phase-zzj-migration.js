require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')
const fs = require('fs')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    const sql = fs.readFileSync('prisma/migrations/phase_zzj_va_concerns_support_requests.sql', 'utf8')
    console.log('Running Phase ZZJ migration...')
    await pool.query(sql)
    console.log('Migration complete — va_concerns table, NotificationType.SUPPORT_REQUEST + VA_CONCERN')
  } catch (e) {
    console.error('Migration error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
