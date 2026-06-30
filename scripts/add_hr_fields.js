const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 15000,
  })
  const client = await pool.connect()
  try {
    // user_profiles new columns
    const userProfileCols = [
      { name: 'whatsapp_number', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS whatsapp_number TEXT' },
      { name: 'gender', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS gender TEXT' },
      { name: 'non_celebrant', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS non_celebrant BOOLEAN DEFAULT false' },
      { name: 'barangay', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS barangay TEXT' },
      { name: 'city_municipality', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS city_municipality TEXT' },
      { name: 'province', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS province TEXT' },
      { name: 'zip_code', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS zip_code TEXT' },
      { name: 'landmark', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS landmark TEXT' },
      { name: 'passport_number', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS passport_number TEXT' },
      { name: 'passport_photo', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS passport_photo TEXT' },
      { name: 'philhealth_number', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS philhealth_number TEXT' },
      { name: 'philhealth_photo', sql: 'ALTER TABLE public.user_profiles ADD COLUMN IF NOT EXISTS philhealth_photo TEXT' },
    ]
    for (const c of userProfileCols) {
      try { await client.query(c.sql); console.log(`user_profiles.${c.name}: OK`) } catch (e) { console.log(`user_profiles.${c.name}: ${e.message}`) }
    }

    // va_profiles new columns
    const vaProfileCols = [
      { name: 'base_rate', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS base_rate DECIMAL' },
      { name: 'vaa_position', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS vaa_position TEXT' },
      { name: 'level', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS level TEXT' },
      { name: 'preferred_work_hours', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS preferred_work_hours DECIMAL' },
      { name: 'available_schedule', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS available_schedule TEXT' },
      { name: 'hybrid', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS hybrid BOOLEAN DEFAULT false' },
      { name: 'contract_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS contract_link TEXT' },
      { name: 'folder_201_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS folder_201_link TEXT' },
      { name: 'file_201_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS file_201_link TEXT' },
      { name: 'va_client_file_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS va_client_file_link TEXT' },
      { name: 'health_check_file_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS health_check_file_link TEXT' },
      { name: 'va_profile_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS va_profile_link TEXT' },
      { name: 'payout_summary_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS payout_summary_link TEXT' },
      { name: 'dept_201_folder_link', sql: 'ALTER TABLE public.va_profiles ADD COLUMN IF NOT EXISTS dept_201_folder_link TEXT' },
    ]
    for (const c of vaProfileCols) {
      try { await client.query(c.sql); console.log(`va_profiles.${c.name}: OK`) } catch (e) { console.log(`va_profiles.${c.name}: ${e.message}`) }
    }

    console.log('\nDone')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })