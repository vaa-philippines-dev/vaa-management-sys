const { Pool } = require('pg')

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true',
    max: 1,
    connectionTimeoutMillis: 30000,
  })
  const client = await pool.connect()
  try {
    console.log('=== STEP 1: Rename createdAt/updatedAt to created_at/updated_at ===')
    const tables = ['users', 'va_profiles', 'clients', 'assignments', 'work_logs', 'skills']
    for (const table of tables) {
      try {
        // Check if createdAt exists
        const check = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name IN ('createdAt', 'updatedAt', 'created_at', 'updated_at')`, [table])
        const colNames = check.rows.map(r => r.column_name)

        if (colNames.includes('createdAt')) {
          if (colNames.includes('created_at')) {
            // Both exist - drop createdAt (the new created_at was added by our migration)
            await client.query(`ALTER TABLE public.${table} DROP COLUMN "createdAt"`)
            console.log(`  ${table}: dropped duplicate createdAt (kept created_at)`)
          } else {
            await client.query(`ALTER TABLE public.${table} RENAME COLUMN "createdAt" TO "created_at"`)
            console.log(`  ${table}: renamed createdAt -> created_at`)
          }
        } else if (colNames.includes('created_at')) {
          console.log(`  ${table}: created_at already exists`)
        }

        if (colNames.includes('updatedAt')) {
          if (colNames.includes('updated_at')) {
            await client.query(`ALTER TABLE public.${table} DROP COLUMN "updatedAt"`)
            console.log(`  ${table}: dropped duplicate updatedAt (kept updated_at)`)
          } else {
            await client.query(`ALTER TABLE public.${table} RENAME COLUMN "updatedAt" TO "updated_at"`)
            console.log(`  ${table}: renamed updatedAt -> updated_at`)
          }
        } else if (colNames.includes('updated_at')) {
          console.log(`  ${table}: updated_at already exists`)
        }
      } catch (err) {
        console.log(`  ${table}: ERROR - ${err.message}`)
      }
    }

    console.log('\n=== STEP 2: Create missing tables ===')

    console.log('Creating departments...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.departments (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        parent_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
        is_parent BOOLEAN DEFAULT false,
        description TEXT,
        head_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating positions...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.positions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        reports_to_id TEXT REFERENCES public.positions(id) ON DELETE SET NULL,
        department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
        is_staff_role BOOLEAN DEFAULT false,
        sort_order INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating department_memberships...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.department_memberships (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        department_id TEXT NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
        position_id TEXT REFERENCES public.positions(id) ON DELETE SET NULL,
        is_primary BOOLEAN DEFAULT false,
        started_at TIMESTAMP DEFAULT NOW(),
        ended_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id, department_id)
      )
    `)

    console.log('Creating user_profiles...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.user_profiles (
        id TEXT PRIMARY KEY,
        user_id TEXT UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        phone TEXT,
        birth_date TIMESTAMP,
        address TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        emergency_contact_relation TEXT,
        gcash_number TEXT,
        facebook_url TEXT,
        linkedin_url TEXT,
        personality_traits TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating employment_records...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.employment_records (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        contract_type TEXT NOT NULL,
        employment_status TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP,
        effective_date TIMESTAMP DEFAULT NOW(),
        reason TEXT,
        initiated_by TEXT REFERENCES public.users(id) ON DELETE SET NULL,
        is_current BOOLEAN DEFAULT true,
        tenure_days INTEGER,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating role_assignments...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.role_assignments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        role TEXT NOT NULL,
        module TEXT NOT NULL,
        department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
        granted_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating va_skills...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.va_skills (
        id TEXT PRIMARY KEY,
        va_profile_id TEXT NOT NULL REFERENCES public.va_profiles(id) ON DELETE CASCADE,
        skill_id TEXT NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
        proficiency TEXT DEFAULT 'INTERMEDIATE',
        years_experience DECIMAL,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(va_profile_id, skill_id)
      )
    `)

    console.log('Creating va_documents...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.va_documents (
        id TEXT PRIMARY KEY,
        va_profile_id TEXT NOT NULL REFERENCES public.va_profiles(id) ON DELETE CASCADE,
        document_type TEXT NOT NULL,
        file_name TEXT NOT NULL,
        google_drive_url TEXT NOT NULL,
        mime_type TEXT,
        file_size INTEGER,
        uploaded_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating leave_requests...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.leave_requests (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        leave_type TEXT NOT NULL,
        start_date TIMESTAMP NOT NULL,
        end_date TIMESTAMP NOT NULL,
        total_days DECIMAL NOT NULL,
        reason TEXT,
        status TEXT DEFAULT 'PENDING',
        approver_id TEXT REFERENCES public.users(id) ON DELETE SET NULL,
        approved_at TIMESTAMP,
        approver_note TEXT,
        notification_sent BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating tickets...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.tickets (
        id TEXT PRIMARY KEY,
        ticket_number TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        category TEXT NOT NULL,
        priority TEXT DEFAULT 'MEDIUM',
        status TEXT DEFAULT 'OPEN',
        source TEXT DEFAULT 'INTERNAL',
        created_by TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        assigned_to TEXT REFERENCES public.users(id) ON DELETE SET NULL,
        department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
        client_id TEXT REFERENCES public.clients(id) ON DELETE SET NULL,
        resolved_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating ticket_conversations...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.ticket_conversations (
        id TEXT PRIMARY KEY,
        ticket_id TEXT NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_internal_note BOOLEAN DEFAULT false,
        attachments TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('Creating audit_logs...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        old_values JSONB,
        new_values JSONB,
        metadata JSONB,
        department_id TEXT REFERENCES public.departments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `)

    console.log('\n=== STEP 3: Create default departments ===')
    const deptCount = await client.query(`SELECT COUNT(*) FROM public.departments`)
    if (parseInt(deptCount.rows[0].count) === 0) {
      await client.query(`
        INSERT INTO public.departments (id, name, is_parent, description, sort_order, is_active) VALUES
          ('dept_admin', 'Admin', true, 'System administration and management', 1, true),
          ('dept_hr', 'HR Department', true, 'Human Resources', 2, true),
          ('dept_operations', 'Operations', true, 'Operations and client management', 3, true),
          ('dept_va_panel', 'VA Panel', true, 'Virtual Assistant management panel', 4, true)
        ON CONFLICT (name) DO NOTHING
      `)
      console.log('Created default departments')
    } else {
      console.log('Departments already exist')
    }

    console.log('\n=== STEP 4: Ensure admin user exists ===')
    const adminExists = await client.query(`SELECT id FROM public.users WHERE email = 'neilandreibona@gmail.com'`)
    if (adminExists.rows.length === 0) {
      await client.query(`
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
      `)
      console.log('Created admin user')
    } else {
      await client.query(`
        UPDATE public.users SET
          system_role = 'SUPER_ADMIN',
          user_type = 'INTERNAL_STAFF',
          first_name = 'Neil Andre',
          last_name = 'Ibona',
          is_active = true,
          updated_at = NOW()
        WHERE email = 'neilandreibona@gmail.com'
      `)
      console.log('Updated admin user')
    }

    console.log('\n=== DONE ===')
  } catch (err) {
    console.error('FATAL:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

run().catch(e => { console.error(e.message); process.exit(1) })