const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 15000,
  })
  const client = await pool.connect()
  try {
    console.log('Linking VA profiles to users by order...\n')

    // Get all VAs (null user_id) and users with system_role = 'VA'
    const orphanVAs = await client.query(`SELECT id FROM public.va_profiles WHERE user_id IS NULL ORDER BY id`)
    const vaUsers = await client.query(`SELECT id, email FROM public.users WHERE system_role = 'VA' ORDER BY email`)

    console.log(`Orphan VA profiles: ${orphanVAs.rows.length}`)
    console.log(`VA users: ${vaUsers.rows.length}`)

    // Link them up
    for (let i = 0; i < Math.min(orphanVAs.rows.length, vaUsers.rows.length); i++) {
      await client.query(`UPDATE public.va_profiles SET user_id = $1 WHERE id = $2`, [vaUsers.rows[i].id, orphanVAs.rows[i].id])
      console.log(`Linked VA profile ${orphanVAs.rows[i].id} -> user ${vaUsers.rows[i].email}`)
    }

    console.log('\nVerifying...')
    const verify = await client.query(`
      SELECT vp.id, vp.user_id, u.first_name, u.last_name, u.email
      FROM public.va_profiles vp
      LEFT JOIN public.users u ON vp.user_id = u.id
    `)
    verify.rows.forEach(r => console.log(JSON.stringify(r)))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })