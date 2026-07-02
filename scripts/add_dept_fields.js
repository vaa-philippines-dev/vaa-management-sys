require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  })

  try {
    await pool.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "short_name" TEXT`)
    console.log('Added short_name column')
    await pool.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "acronym" TEXT`)
    console.log('Added acronym column')
    await pool.query(`ALTER TABLE "departments" ADD COLUMN IF NOT EXISTS "level" TEXT`)
    console.log('Added level column')
    try {
      await pool.query(`CREATE UNIQUE INDEX "departments_acronym_key" ON "departments"("acronym") WHERE "acronym" IS NOT NULL`)
      console.log('Created acronym unique index')
    } catch (e) {
      if (e.message?.includes('already exists')) {
        console.log('acronym unique index already exists')
      } else {
        throw e
      }
    }
    console.log('Migration complete')
  } finally {
    await pool.end()
  }
}

main()
