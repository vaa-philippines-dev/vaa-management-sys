const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    console.log('1. Add first_name column...')
    await client.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name TEXT DEFAULT ''`)
    console.log('   OK')

    console.log('2. Migrate name → first_name + last_name...')
    await client.query(`
      UPDATE public.users SET 
        first_name = COALESCE(SPLIT_PART(name, ' ', 1), ''),
        last_name = CASE 
          WHEN POSITION(' ' IN name) > 0 THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
          ELSE ''
        END
      WHERE name IS NOT NULL AND name != ''
    `)
    console.log('   OK')

    console.log('3. Set neilandreibona@gmail.com as SUPER_ADMIN...')
    await client.query(`
      UPDATE public.users SET 
        system_role = 'SUPER_ADMIN',
        user_type = 'INTERNAL_STAFF',
        first_name = 'Neil Andre',
        last_name = 'Ibona',
        avatar_url = 'https://lh3.googleusercontent.com/a/ACg8ocJxuMFc4FLGS3XXMOXfmZJW93PaBAUS08nBzC1o0a5XvasI9R0=s96-c'
      WHERE email = 'neilandreibona@gmail.com'
    `)
    console.log('   OK')

    console.log('4. Fix existing VAs to VIRTUAL_ASSISTANT type...')
    await client.query(`
      UPDATE public.users SET user_type = 'VIRTUAL_ASSISTANT', system_role = 'VA'
      WHERE email IN ('va1@example.com', 'va2@example.com', 'va3@example.com')
    `)
    console.log('   OK')

    console.log('5. Add user_id column to va_profiles...')
    const hasUserId = await client.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'va_profiles' AND column_name = 'user_id'
    `)
    if (hasUserId.rows.length === 0) {
      await client.query(`ALTER TABLE public.va_profiles ADD COLUMN user_id TEXT`)
      await client.query(`UPDATE public.va_profiles vp SET user_id = u.id FROM public.users u WHERE u.email LIKE vp.id || '%'`)
      console.log('   OK')
    } else {
      console.log('   (already exists)')
    }

    console.log('6. Add updated_at to assignments...')
    await client.query(`ALTER TABLE public.assignments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`)
    console.log('   OK')

    console.log('\n--- Final state ---')
    const users = await client.query(`SELECT email, first_name, last_name, system_role, user_type FROM public.users ORDER BY email`)
    users.rows.forEach(r => console.log(JSON.stringify(r)))
  } finally {
    client.release()
    await pool.end()
  }
  console.log('\nDone.')
}

run().catch(e => { console.error(e.message); process.exit(1) })
