const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 10000,
  })
  const client = await pool.connect()
  try {
    // Find assignments with VA profiles that have no user
    const broken = await client.query(`
      SELECT a.id
      FROM public.assignments a
      INNER JOIN public.va_profiles vp ON a.va_profile_id = vp.id
      LEFT JOIN public.users u ON vp.user_id = u.id
      WHERE u.id IS NULL
    `)

    if (broken.rows.length > 0) {
      console.log(`Deleting ${broken.rows.length} broken assignments...`)
      for (const row of broken.rows) {
        await client.query(`DELETE FROM public.work_logs WHERE assignment_id = $1`, [row.id])
        await client.query(`DELETE FROM public.assignments WHERE id = $1`, [row.id])
        console.log(`Deleted assignment ${row.id} (with cascade worklogs)`)
      }
    }

    // Verify all assignments have valid VA→user chains
    const remaining = await client.query(`
      SELECT COUNT(*) as broken_count
      FROM public.assignments a
      INNER JOIN public.va_profiles vp ON a.va_profile_id = vp.id
      LEFT JOIN public.users u ON vp.user_id = u.id
      WHERE u.id IS NULL
    `)
    console.log(`\nBroken assignments remaining: ${remaining.rows[0].broken_count}`)

    // Also delete orphan VA profiles
    const orphanVAs = await client.query(`SELECT id FROM public.va_profiles WHERE user_id IS NULL`)
    if (orphanVAs.rows.length > 0) {
      console.log(`Deleting ${orphanVAs.rows.length} orphan VA profiles...`)
      for (const row of orphanVAs.rows) {
        await client.query(`DELETE FROM public.va_profiles WHERE id = $1`, [row.id])
        console.log(`Deleted VA profile ${row.id}`)
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })