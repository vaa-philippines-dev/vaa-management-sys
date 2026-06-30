const fs = require('fs')
const { Pool } = require('pg')

async function run() {
  const sql = fs.readFileSync('C:/Users/playb/AppData/Local/Temp/kilo/migrate.sql', 'utf8')
  
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 30000,
    idleTimeoutMillis: 10000,
  })

  // Split by semicolons and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  const client = await pool.connect()
  try {
    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i]
      const preview = stmt.substring(0, 80).replace(/\s+/g, ' ')
      process.stdout.write(`[${i + 1}/${statements.length}] ${preview}... `)
      try {
        await client.query(stmt)
        console.log('OK')
      } catch (err) {
        console.log(`ERROR: ${err.message}`)
        // Continue with next statement
      }
    }
  } finally {
    client.release()
    await pool.end()
  }
  console.log('\nDone.')
}

run().catch(e => { console.error(e.message); process.exit(1) })
