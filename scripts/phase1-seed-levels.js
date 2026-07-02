require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  })

  try {
    console.log('Seeding Executive level + converting existing levels to enum...')

    const existing = await pool.query(`SELECT id FROM departments WHERE name = 'Executive' AND level = 'EXECUTIVE'`)
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO departments (id, name, short_name, acronym, level, status, parent_id, is_parent, sort_order, created_at, updated_at)
         VALUES (gen_random_uuid()::text, 'Executive', 'Executive', 'EXEC', 'EXECUTIVE', 'ACTIVE', null, true, 0, now(), now())
         ON CONFLICT (name) DO UPDATE SET level = 'EXECUTIVE', status = 'ACTIVE', is_parent = true`
      )
      console.log('Created Executive level')
    } else {
      console.log('Executive level already exists')
    }

    const r = await pool.query(`
      SELECT d.id, d.name, d.level as old_level
      FROM departments d
      WHERE d.level IS NULL AND d.name IN ('Management', 'Service')
    `)
    for (const row of r.rows) {
      const newLevel = row.old_level === 'Management' ? 'MANAGEMENT' : 'SERVICE'
      await pool.query(`UPDATE departments SET level = $1 WHERE id = $2`, [newLevel, row.id])
      console.log(`Converted ${row.name} level to ${newLevel}`)
    }

    const all = await pool.query(`
      SELECT name, level, status, parent_id, is_parent
      FROM departments
      WHERE name IN ('Executive', 'Management', 'Service', 'Staff Department', 'VA Management')
      ORDER BY sort_order
    `)
    console.log('\nLevel records:')
    for (const d of all.rows) {
      console.log(`  ${d.name} (level=${d.level}, status=${d.status}, parent=${d.parent_id ? 'yes' : 'no'}, isParent=${d.is_parent})`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
