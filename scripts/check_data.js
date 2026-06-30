const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    // Check for assignments with broken va_profile references
    const broken = await client.query(`
      SELECT a.id, a.va_profile_id, vp.id as vp_exists, vp.user_id, u.id as user_exists
      FROM public.assignments a
      LEFT JOIN public.va_profiles vp ON a.va_profile_id = vp.id
      LEFT JOIN public.users u ON vp.user_id = u.id
      WHERE vp.id IS NULL OR u.id IS NULL
    `)
    console.log('Broken assignments:', broken.rows.length)
    broken.rows.forEach(r => console.log(JSON.stringify(r)))

    // Check assignments with null va_profile
    const nullVP = await client.query(`SELECT COUNT(*) FROM public.assignments WHERE va_profile_id IS NULL`)
    console.log('\nAssignments with null va_profile_id:', nullVP.rows[0].count)

    // Check all VA profiles
    const vas = await client.query(`SELECT vp.id, vp.user_id, u.first_name, u.last_name FROM public.va_profiles vp LEFT JOIN public.users u ON vp.user_id = u.id`)
    console.log('\nAll VA profiles:')
    vas.rows.forEach(r => console.log(JSON.stringify(r)))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })