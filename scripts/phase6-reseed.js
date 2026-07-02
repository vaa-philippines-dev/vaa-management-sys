require('dotenv').config({ path: '.env.local' })
const { Pool } = require('pg')

const HIERARCHY = [
  {
    name: 'Executive', level: 'EXECUTIVE', parentName: null, sortOrder: 1, shortName: 'Executive', acronym: 'EXEC', isParent: true,
  },
  {
    name: 'Management', level: 'MANAGEMENT', parentName: null, sortOrder: 2, shortName: 'Management', acronym: 'MGMT', isParent: true,
  },
  {
    name: 'Service', level: 'SERVICE', parentName: null, sortOrder: 3, shortName: 'Service', acronym: 'SRVC', isParent: true,
  },

  {
    name: 'CEO', shortName: 'CEO', acronym: 'CEO', level: 'EXECUTIVE', parentName: 'Executive', sortOrder: 4, isParent: false,
  },
  {
    name: 'COO', shortName: 'COO', acronym: 'COO', level: 'EXECUTIVE', parentName: 'Executive', sortOrder: 5, isParent: false,
  },
  {
    name: 'CFO', shortName: 'CFO', acronym: 'CFO', level: 'EXECUTIVE', parentName: 'Executive', sortOrder: 6, isParent: false,
  },

  {
    name: 'Human Resources', shortName: 'HR', acronym: 'HR', level: 'MANAGEMENT', parentName: 'Management', sortOrder: 7, isParent: false,
  },
  {
    name: 'Business Operations', shortName: 'Bus. Ops', acronym: 'BIZOPS', level: 'MANAGEMENT', parentName: 'Management', sortOrder: 8, isParent: false,
  },
  {
    name: 'Administrator', shortName: 'Admin', acronym: 'ADMIN', level: 'MANAGEMENT', parentName: 'Management', sortOrder: 9, isParent: false,
  },
  {
    name: 'Customer Success', shortName: 'Customer Success', acronym: 'CS', level: 'MANAGEMENT', parentName: 'Management', sortOrder: 10, isParent: false,
  },

  {
    name: 'Amazon Department', shortName: 'Amazon', acronym: 'AMZD', level: 'SERVICE', parentName: 'Service', sortOrder: 11, isParent: true,
  },
  {
    name: 'Wholesale Department', shortName: 'Wholesale', acronym: 'WSD', level: 'SERVICE', parentName: 'Service', sortOrder: 12, isParent: true,
  },
  {
    name: 'PPC Department', shortName: 'PPC', acronym: 'PPCD', level: 'SERVICE', parentName: 'Service', sortOrder: 13, isParent: true,
  },
  {
    name: 'Social Media Department', shortName: 'Social Media', acronym: 'SMD', level: 'SERVICE', parentName: 'Service', sortOrder: 14, isParent: true,
  },
  {
    name: 'Executive Assistant Department', shortName: 'Executive Assistant', acronym: 'EAD', level: 'SERVICE', parentName: 'Service', sortOrder: 15, isParent: true,
  },
  {
    name: 'Walmart Department', shortName: 'Walmart', acronym: 'WMD', level: 'SERVICE', parentName: 'Service', sortOrder: 16, isParent: true,
  },
  {
    name: 'Creatives Department', shortName: 'Creatives', acronym: 'CRTV', level: 'SERVICE', parentName: 'Service', sortOrder: 17, isParent: true,
  },

  { name: 'Amazon Virtual Assistant', shortName: 'Amazon VA', acronym: 'AMZ', level: 'SERVICE', parentName: 'Amazon Department', sortOrder: 18, isParent: false },

  { name: 'Wholesale Virtual Assistant', shortName: 'Wholesale VA', acronym: 'WS', level: 'SERVICE', parentName: 'Wholesale Department', sortOrder: 19, isParent: false },

  { name: 'Amazon PPC Virtual Assistant', shortName: 'Amazon PPC VA', acronym: 'APPC', level: 'SERVICE', parentName: 'PPC Department', sortOrder: 20, isParent: false },
  { name: 'Walmart PPC Virtual Assistant', shortName: 'Walmart PPC VA', acronym: 'WPPC', level: 'SERVICE', parentName: 'PPC Department', sortOrder: 21, isParent: false },

  { name: 'Social Media Virtual Assistant', shortName: 'Social Media VA', acronym: 'SM', level: 'SERVICE', parentName: 'Social Media Department', sortOrder: 22, isParent: false },
  { name: 'Copywriter Virtual Assistant', shortName: 'Copywriter VA', acronym: 'CW', level: 'SERVICE', parentName: 'Social Media Department', sortOrder: 23, isParent: false },

  { name: 'Executive Assistant Virtual Assistant', shortName: 'Executive Assistant VA', acronym: 'EA', level: 'SERVICE', parentName: 'Executive Assistant Department', sortOrder: 24, isParent: false },
  { name: 'Executive Bookkeeper Virtual Assistant', shortName: 'Bookkeeper VA', acronym: 'BK', level: 'SERVICE', parentName: 'Executive Assistant Department', sortOrder: 25, isParent: false },
  { name: 'Amazon CSR Virtual Assistant', shortName: 'Amazon CSR VA', acronym: 'ACSR', level: 'SERVICE', parentName: 'Executive Assistant Department', sortOrder: 26, isParent: false },
  { name: 'Customer Service Representative Virtual Assistant', shortName: 'Customer Service Rep VA', acronym: 'CSR', level: 'SERVICE', parentName: 'Executive Assistant Department', sortOrder: 27, isParent: false },

  { name: 'Walmart Virtual Assistant', shortName: 'Walmart VA', acronym: 'WM', level: 'SERVICE', parentName: 'Walmart Department', sortOrder: 28, isParent: false },

  { name: 'Graphics Designer Virtual Assistant', shortName: 'Graphics Designer VA', acronym: 'CD', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 29, isParent: false },
  { name: '3D Graphics Designer Virtual Assistant', shortName: '3D Graphics Designer VA', acronym: 'TGD', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 30, isParent: false },
  { name: 'Video Editor Virtual Assistant', shortName: 'Video Editor VA', acronym: 'VE', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 31, isParent: false },
  { name: 'Copywriter Virtual Assistant', shortName: 'Copywriter VA', acronym: 'CW', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 32, isParent: false },
  { name: 'Production Artist Virtual Assistant', shortName: 'Production Artist VA', acronym: 'PA', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 33, isParent: false },
  { name: 'Quality Assurance Virtual Assistant', shortName: 'Quality Assurance VA', acronym: 'QA', level: 'SERVICE', parentName: 'Creatives Department', sortOrder: 34, isParent: false },
]

async function main() {
  const pool = new Pool({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  })

  try {
    console.log('=== Phase 6: Department Restructure ===\n')

    console.log('Step 1: Wiping all existing department memberships and department data...')
    await pool.query('DELETE FROM "department_memberships"')
    console.log('  - Cleared department_memberships')
    await pool.query('DELETE FROM "role_assignments" WHERE "department_id" IS NOT NULL')
    console.log('  - Cleared role_assignments with department_id')
    await pool.query('UPDATE "clients" SET "department_id" = NULL WHERE "department_id" IS NOT NULL')
    console.log('  - Nulled client.department_id')
    await pool.query('DELETE FROM "audit_logs" WHERE "entity_type" = \'Department\'')
    console.log('  - Cleared Department audit logs')
    await pool.query('DELETE FROM "departments"')
    console.log('  - Cleared all departments')

    console.log('\nStep 2: Applying schema migration (compound unique)...')
    const sql = require('fs').readFileSync('prisma/migrations/phase6_compound_unique.sql', 'utf8')
    await pool.query(sql)
    console.log('  - Migration applied')

    console.log('\nStep 3: Seeding new hierarchy...')
    const byName = {}

    for (const dept of HIERARCHY) {
      let parentId = null
      if (dept.parentName) {
        if (byName[dept.parentName]) {
          parentId = byName[dept.parentName]
        } else {
          const r = await pool.query('SELECT id FROM departments WHERE name = $1', [dept.parentName])
          if (r.rows.length === 0) {
            console.warn(`  ⚠ Parent "${dept.parentName}" not found for "${dept.name}", skipping`)
            continue
          }
          parentId = r.rows[0].id
          byName[dept.parentName] = parentId
        }
      }

      const r = await pool.query(
        `INSERT INTO departments (id, name, short_name, acronym, level, status, parent_id, is_parent, sort_order, created_at, updated_at)
         VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 'ACTIVE', $5, $6, $7, now(), now())
         ON CONFLICT (name, COALESCE(parent_id, '')) DO UPDATE
         SET short_name = $2, acronym = $3, level = $4, status = 'ACTIVE', is_parent = $6, sort_order = $7, updated_at = now()
         RETURNING id`,
        [dept.name, dept.shortName, dept.acronym, dept.level, parentId, dept.isParent, dept.sortOrder]
      )
      byName[dept.name] = r.rows[0].id
      console.log(`  ✓ ${dept.parentName ? '  ' : ''}${dept.name} [${dept.acronym}] (${dept.level})`)
    }

    console.log('\nStep 4: Verifying final hierarchy...')
    const all = await pool.query(`
      SELECT d.id, d.name, d.short_name, d.acronym, d.level, d.sort_order, d.is_parent, p.name as parent_name
      FROM departments d
      LEFT JOIN departments p ON d.parent_id = p.id
      ORDER BY d.level, d.sort_order
    `)
    const byLevel = {}
    for (const row of all.rows) {
      if (!byLevel[row.level]) byLevel[row.level] = []
      byLevel[row.level].push(row)
    }
    for (const level of ['EXECUTIVE', 'MANAGEMENT', 'SERVICE']) {
      console.log(`\n  ${level}:`)
      for (const row of (byLevel[level] || [])) {
        if (!row.parent_name) {
          console.log(`    ${row.name} [${row.acronym}] (Level record)`)
          for (const child of (byLevel[level] || []).filter((r) => r.parent_name === row.name)) {
            console.log(`      └─ ${child.name} [${child.acronym}]`)
            for (const grandchild of (byLevel[level] || []).filter((r) => r.parent_name === child.name)) {
              console.log(`          └─ ${grandchild.name} [${grandchild.acronym}]`)
            }
          }
        }
      }
    }

    console.log(`\n✅ Phase 6 complete. Total departments: ${all.rows.length}`)
  } catch (e) {
    console.error('Error:', e.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
