const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    console.log('--- Current users ---')
    const users = await client.query('SELECT id, email, first_name, last_name, system_role, user_type, is_active FROM public.users WHERE email LIKE $1 ORDER BY email', ['%neil%'])
    users.rows.forEach(r => console.log(JSON.stringify(r)))

    console.log('\n--- Setting neilandreibona@gmail.com as SUPER_ADMIN ---')
    const result = await client.query(`
      INSERT INTO public.users (id, email, first_name, last_name, system_role, user_type, avatar_url, is_active, created_at, updated_at)
      VALUES (
        'cmprd76620000kg07s56mpbev',
        'neilandreibona@gmail.com',
        'Neil Andre',
        'Ibona',
        'SUPER_ADMIN',
        'INTERNAL_STAFF',
        'https://lh3.googleusercontent.com/a/ACg8ocJxuMFc4FLGS3XXMOXfmZJW93PaBAUS08nBzC1o0a5XvasI9R0=s96-c',
        true,
        NOW(),
        NOW()
      )
      ON CONFLICT (email) DO UPDATE SET
        system_role = 'SUPER_ADMIN',
        user_type = 'INTERNAL_STAFF',
        first_name = 'Neil Andre',
        last_name = 'Ibona',
        is_active = true,
        updated_at = NOW()
      RETURNING *
    `)
    console.log('Result:', JSON.stringify(result.rows[0], null, 2))

    console.log('\n--- Verifying ---')
    const verify = await client.query(`SELECT id, email, first_name, last_name, system_role, user_type, is_active FROM public.users WHERE email = 'neilandreibona@gmail.com'`)
    console.log(JSON.stringify(verify.rows[0], null, 2))
  } finally {
    client.release()
    await pool.end()
  }
  console.log('\nDone.')
}

run().catch(e => { console.error(e.message); process.exit(1) })