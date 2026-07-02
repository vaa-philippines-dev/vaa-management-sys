require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const DEPARTMENTS = [
  { name: 'Staff Department', shortName: 'Staff', acronym: 'STAFF', level: 'Management', parentName: 'Management', isParent: true, sortOrder: 1 },
  { name: 'Customer Success', shortName: 'Customer Success', acronym: 'CS', level: 'Management', parentName: 'Staff Department', isParent: false, sortOrder: 2 },
  { name: 'Human Resources', shortName: 'HR', acronym: 'HR', level: 'Management', parentName: 'Staff Department', isParent: false, sortOrder: 3 },
  { name: 'Software Development', shortName: 'Software Dev', acronym: 'DEV', level: 'Management', parentName: 'Staff Department', isParent: false, sortOrder: 4 },
  { name: 'Business Operations', shortName: 'Bus. Ops', acronym: 'BIZOPS', level: 'Management', parentName: 'Staff Department', isParent: false, sortOrder: 5 },
  { name: 'Admin Department', shortName: 'Admin', acronym: 'ADMIN', level: 'Management', parentName: 'Staff Department', isParent: false, sortOrder: 6 },
  { name: 'VA Management', shortName: 'VA Management', acronym: 'VAMGT', level: 'Service', parentName: 'Service', isParent: true, sortOrder: 7 },
  { name: 'Amazon Department', shortName: 'Amazon', acronym: 'AMZ', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 8 },
  { name: 'Wholesale Department', shortName: 'Wholesale', acronym: 'WS', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 9 },
  { name: 'PPC Department', shortName: 'PPC', acronym: 'PPC', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 10 },
  { name: 'Social Media Department', shortName: 'Social Media', acronym: 'SM', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 11 },
  { name: 'Executive Assistant Department', shortName: 'Executive Assistant', acronym: 'EA', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 12 },
  { name: 'Walmart Department', shortName: 'Walmart', acronym: 'WM', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 13 },
  { name: 'Creatives Department', shortName: 'Creatives', acronym: 'CRTV', level: 'Service', parentName: 'VA Management', isParent: false, sortOrder: 14 },
]

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  })

  try {
    console.log('Seeding department hierarchy...')

    console.log('Creating top-level Level records (Management, Service)...')
    for (const level of ['Management', 'Service']) {
      const existing = await pool.query(`SELECT id FROM departments WHERE name = $1`, [level])
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO departments (id, name, short_name, acronym, level, parent_id, is_parent, sort_order, is_active, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $1, $1, $1, null, true, 0, true, now(), now())`,
          [level]
        )
        console.log(`Created level: ${level}`)
      } else {
        await pool.query(
          `UPDATE departments SET is_active = true, level = $1 WHERE id = $2`,
          [level, existing.rows[0].id]
        )
        console.log(`Level already exists: ${level}`)
      }
    }

    const byName = {}

    for (const dept of DEPARTMENTS) {
      let parentId = null
      if (dept.parentName) {
        if (byName[dept.parentName]) {
          parentId = byName[dept.parentName]
        } else {
          const r = await pool.query(`SELECT id FROM departments WHERE name = $1`, [dept.parentName])
          if (r.rows.length === 0) {
            console.warn(`Parent "${dept.parentName}" not found, skipping "${dept.name}"`)
            continue
          }
          parentId = r.rows[0].id
          byName[dept.parentName] = parentId
        }
      }

      const existing = await pool.query(`SELECT id FROM departments WHERE name = $1`, [dept.name])

      if (existing.rows.length > 0) {
        await pool.query(
          `UPDATE departments SET short_name = $1, acronym = $2, level = $3, parent_id = $4, is_parent = $5, sort_order = $6, is_active = true WHERE id = $7`,
          [dept.shortName, dept.acronym, dept.level, parentId, dept.isParent, dept.sortOrder, existing.rows[0].id]
        )
        byName[dept.name] = existing.rows[0].id
        console.log(`Updated: ${dept.name} (${dept.acronym}) -> parent: ${dept.parentName ?? 'none'}`)
      } else {
        const r = await pool.query(
          `INSERT INTO departments (id, name, short_name, acronym, level, parent_id, is_parent, sort_order, is_active, created_at, updated_at)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, true, now(), now())
           ON CONFLICT (name) DO UPDATE SET short_name = $2, acronym = $3, level = $4, parent_id = $5, is_parent = $6, sort_order = $7
           RETURNING id`,
          [dept.name, dept.shortName, dept.acronym, dept.level, parentId, dept.isParent, dept.sortOrder]
        )
        byName[dept.name] = r.rows[0].id
        console.log(`Created: ${dept.name} (${dept.acronym}) -> parent: ${dept.parentName ?? 'none'}`)
      }
    }

    console.log('\nFinal hierarchy:')
    const all = await pool.query(`
      SELECT d.id, d.name, d.acronym, d.level, d.sort_order, d.is_parent, p.name as parent_name
      FROM departments d
      LEFT JOIN departments p ON d.parent_id = p.id
      WHERE d.name = ANY($1)
      ORDER BY d.sort_order ASC
    `, [DEPARTMENTS.map(d => d.name)])

    const top = all.rows.filter(r => !r.parent_name || ['Management', 'Service'].includes(r.parent_name))
    for (const d of top) {
      console.log(`\n${d.name} [${d.acronym}] (${d.level}, sort:${d.sort_order})`)
      const children = all.rows.filter(r => r.parent_name === d.name)
      for (const c of children) {
        console.log(`  └─ ${c.name} [${c.acronym}] (${c.level})`)
      }
    }

    console.log('\nDone.')
  } finally {
    await pool.end()
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
