require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  })

  try {
    const values = ['FILE_UPLOAD', 'SIGN_IN', 'SIGN_OUT', 'MEMBER_ADD', 'MEMBER_REMOVE', 'ROLE_CHANGE', 'LOGIN_FAILED']
    for (const v of values) {
      try {
        await pool.query(`ALTER TYPE "AuditAction" ADD VALUE '${v}'`)
        console.log(`Added: ${v}`)
      } catch (e) {
        if (e.message?.includes('already exists')) {
          console.log(`Skipped (exists): ${v}`)
        } else {
          console.error(`Failed: ${v}`, e.message)
        }
      }
    }
    console.log('Done')
  } finally {
    await pool.end()
  }
}

main()
