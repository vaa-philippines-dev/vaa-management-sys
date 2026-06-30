const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 15000,
  })
  const client = await pool.connect()
  try {
    const enums = [
      `CREATE TYPE public."SystemRole" AS ENUM ('SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE', 'DEPT_MANAGER', 'STAFF', 'VA')`,
      `CREATE TYPE public."UserType" AS ENUM ('INTERNAL_STAFF', 'VIRTUAL_ASSISTANT')`,
      `CREATE TYPE public."TemporaryRole" AS ENUM ('CONTRIBUTOR', 'VIEWER', 'APPROVER')`,
      `CREATE TYPE public."Availability" AS ENUM ('AVAILABLE', 'PARTIALLY_ASSIGNED', 'FULLY_ASSIGNED', 'ON_LEAVE', 'UNAVAILABLE')`,
      `CREATE TYPE public."Proficiency" AS ENUM ('BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT')`,
      `CREATE TYPE public."ContractType" AS ENUM ('REGULAR', 'PROJECT_BASED', 'PROBATIONARY')`,
      `CREATE TYPE public."EmploymentStatus" AS ENUM ('EMPLOYED', 'ENGAGED', 'CONTRACTED', 'END_OF_CONTRACT', 'TRANSFERRED', 'RESIGNED', 'TERMINATED', 'BLACKLISTED')`,
      `CREATE TYPE public."LeaveType" AS ENUM ('VACATION', 'SICK', 'EMERGENCY', 'MATERNITY', 'PATERNITY', 'UNPAID', 'BEREAVEMENT')`,
      `CREATE TYPE public."LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`,
      `CREATE TYPE public."DocumentType" AS ENUM ('CONTRACT', 'GOVERNMENT_ID', 'NDA', 'CLEARANCE', 'CERTIFICATE', 'ONBOARDING', 'PERFORMANCE_REVIEW', 'PORTFOLIO', 'OTHER')`,
      `CREATE TYPE public."TicketCategory" AS ENUM ('TECHNICAL', 'HR', 'CLIENT', 'VA_SUPPORT', 'GENERAL')`,
      `CREATE TYPE public."TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED')`,
      `CREATE TYPE public."TicketSource" AS ENUM ('INTERNAL', 'EMAIL', 'WHATSAPP', 'CLIENT_PORTAL')`,
      `CREATE TYPE public."Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT')`,
      `CREATE TYPE public."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'TRANSFER', 'APPROVE', 'REJECT')`,
    ]

    for (const sql of enums) {
      try {
        await client.query(sql)
        const name = sql.match(/CREATE TYPE public\."(\w+)"/)[1]
        console.log(`${name}: CREATED`)
      } catch (e) {
        if (e.message.includes('already exists')) {
          console.log(`${sql.match(/CREATE TYPE public\."(\w+)"/)[1]}: already exists`)
        } else {
          console.log(`${sql.match(/CREATE TYPE public\."(\w+)"/)?.[1] ?? '?'}: ${e.message}`)
        }
      }
    }

    // Now cast columns
    console.log('\n=== Casting columns ===')
    const casts = [
      `ALTER TABLE public.users ALTER COLUMN system_role TYPE public."SystemRole" USING system_role::text::public."SystemRole"`,
      `ALTER TABLE public.users ALTER COLUMN user_type TYPE public."UserType" USING user_type::text::public."UserType"`,
      `ALTER TABLE public.va_profiles ALTER COLUMN availability_status TYPE public."Availability" USING availability_status::text::public."Availability"`,
    ]

    for (const sql of casts) {
      try {
        await client.query(sql)
        console.log('CAST OK:', sql.substring(0, 80))
      } catch (e) {
        console.log('CAST FAIL:', e.message)
      }
    }

    // Set defaults
    await client.query(`ALTER TABLE public.users ALTER COLUMN system_role SET DEFAULT 'STAFF'::public."SystemRole"`)
    await client.query(`ALTER TABLE public.users ALTER COLUMN user_type SET DEFAULT 'INTERNAL_STAFF'::public."UserType"`)
    await client.query(`ALTER TABLE public.va_profiles ALTER COLUMN availability_status SET DEFAULT 'AVAILABLE'::public."Availability"`)
    console.log('Defaults set')

    console.log('\n=== DONE ===')
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })