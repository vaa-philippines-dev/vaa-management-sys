const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 30000,
  })
  const client = await pool.connect()
  try {
    console.log('=== Add missing columns ===\n')

    // clients table - missing: department_id, contact_phone, timezone, onboarding_folder_url
    const clientCols = [
      { name: 'contact_phone', sql: 'ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS contact_phone TEXT' },
      { name: 'department_id', sql: 'ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL' },
      { name: 'timezone', sql: 'ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT \'America/New_York\'' },
      { name: 'onboarding_folder_url', sql: 'ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS onboarding_folder_url TEXT' },
    ]
    for (const c of clientCols) {
      try {
        await client.query(c.sql)
        console.log(`clients.${c.name}: OK`)
      } catch (e) {
        console.log(`clients.${c.name}: ERROR - ${e.message}`)
      }
    }

    // assignments table - missing: skill_requirements
    const assignmentCols = [
      { name: 'skill_requirements', sql: 'ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS skill_requirements TEXT[] DEFAULT \'{}\'' },
    ]
    for (const c of assignmentCols) {
      try {
        await client.query(c.sql)
        console.log(`assignments.${c.name}: OK`)
      } catch (e) {
        console.log(`assignments.${c.name}: ERROR - ${e.message}`)
      }
    }

    // users table - drop old name column if not referenced by Prisma
    // Actually, the new schema doesn't have 'name' column, so let's drop it
    try {
      const hasName = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'name'`)
      if (hasName.rows.length > 0) {
        await client.query(`ALTER TABLE public.users DROP COLUMN name`)
        console.log('users.name: dropped')
      } else {
        console.log('users.name: already dropped')
      }
    } catch (e) {
      console.log(`users.name: ERROR - ${e.message}`)
    }

    // Add index on clients.department_id
    try {
      await client.query(`CREATE INDEX IF NOT EXISTS idx_clients_department_id ON public.clients(department_id)`)
      console.log('clients.department_id index: OK')
    } catch (e) {
      console.log(`clients.department_id index: ERROR - ${e.message}`)
    }

    console.log('\n=== Done ===')
  } catch (err) {
    console.error('FATAL:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })