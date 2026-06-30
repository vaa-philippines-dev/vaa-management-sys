const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 15000,
  })
  const client = await pool.connect()
  try {
    // Drop defaults first
    await client.query(`ALTER TABLE public.users ALTER COLUMN system_role DROP DEFAULT`)
    await client.query(`ALTER TABLE public.users ALTER COLUMN user_type DROP DEFAULT`)
    await client.query(`ALTER TABLE public.va_profiles ALTER COLUMN availability_status DROP DEFAULT`)

    // Cast
    await client.query(`ALTER TABLE public.users ALTER COLUMN system_role TYPE public."SystemRole" USING system_role::text::public."SystemRole"`)
    console.log('users.system_role: cast OK')
    await client.query(`ALTER TABLE public.users ALTER COLUMN user_type TYPE public."UserType" USING user_type::text::public."UserType"`)
    console.log('users.user_type: cast OK')
    await client.query(`ALTER TABLE public.va_profiles ALTER COLUMN availability_status TYPE public."Availability" USING availability_status::text::public."Availability"`)
    console.log('va_profiles.availability_status: cast OK')

    // Re-add defaults
    await client.query(`ALTER TABLE public.users ALTER COLUMN system_role SET DEFAULT 'STAFF'::public."SystemRole"`)
    await client.query(`ALTER TABLE public.users ALTER COLUMN user_type SET DEFAULT 'INTERNAL_STAFF'::public."UserType"`)
    await client.query(`ALTER TABLE public.va_profiles ALTER COLUMN availability_status SET DEFAULT 'AVAILABLE'::public."Availability"`)
    console.log('Defaults restored')

    // Verify
    const check = await client.query(`
      SELECT column_name, data_type, udt_name, column_default 
      FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name IN ('system_role', 'user_type')
    `)
    check.rows.forEach(r => console.log(`${r.column_name}: ${r.udt_name} (default: ${r.column_default})`))

    console.log('\nDONE')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })