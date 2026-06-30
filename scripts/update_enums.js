const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 15000,
  })
  const client = await pool.connect()
  try {
    // Add new values to DocumentType enum
    const addEnumVals = ['FOLDER_201', 'FILE_201', 'VA_CLIENT_FILE', 'HEALTH_CHECK', 'VA_PROFILE', 'PAYOUT_SUMMARY', 'DEPT_201_FOLDER']
    for (const val of addEnumVals) {
      try {
        await client.query(`ALTER TYPE public."DocumentType" ADD VALUE '${val}'`)
        console.log(`DocumentType.${val}: added`)
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`DocumentType.${val}: already exists`)
        } else {
          console.log(`DocumentType.${val}: ${e.message}`)
        }
      }
    }
    
    console.log('\nDone')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })