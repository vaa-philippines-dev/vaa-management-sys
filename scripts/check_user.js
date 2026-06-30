const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    // Check current state
    console.log('=== Current user ===')
    const user = await client.query(`SELECT id, email, system_role, user_type FROM public.users WHERE email = 'operations-admin@vaaphilippines.com'`)
    console.log(JSON.stringify(user.rows[0]))

    // Force update
    console.log('\n=== Forcing update ===')
    await client.query(`UPDATE public.users SET system_role = 'SYSTEM_ADMIN' WHERE email = 'operations-admin@vaaphilippines.com'`)
    
    // Verify
    const verify = await client.query(`SELECT id, email, system_role FROM public.users WHERE email = 'operations-admin@vaaphilippines.com'`)
    console.log('After update:', JSON.stringify(verify.rows[0]))

    // Check enum values
    console.log('\n=== SystemRole enum values ===')
    const enumVals = await client.query(`SELECT unnest(enum_range(NULL::public."SystemRole")) as val`)
    console.log(enumVals.rows.map(r => r.val).join(', '))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })