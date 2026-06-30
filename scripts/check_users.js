const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    const users = await client.query(`SELECT id, email, first_name, last_name, system_role, user_type, is_active FROM public.users WHERE email IN ('neilandreibona@gmail.com', 'playboysright@gmail.com')`)
    console.log('Prisma users:')
    users.rows.forEach(r => console.log(JSON.stringify(r)))
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })