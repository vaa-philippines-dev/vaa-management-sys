const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:6543/postgres',
  });
  await client.connect();
  console.log('connected, creating schema...');

  await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole') THEN CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'VA'); END IF; END $$;`);
  await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT'); END IF; END $$;`);
  await client.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED'); END IF; END $$;`);

  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      role "UserRole" NOT NULL DEFAULT 'VA',
      department TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS va_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone TEXT,
      hourly_rate DECIMAL,
      notes TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      priority "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
      status "TaskStatus" NOT NULL DEFAULT 'TODO',
      due_date TIMESTAMPTZ,
      google_drive_folder_url TEXT,
      department TEXT,
      assigned_to_id TEXT NOT NULL REFERENCES va_profiles(id),
      assigned_by_id TEXT NOT NULL REFERENCES users(id),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON tasks(assigned_by_id)');
  await client.query('CREATE INDEX IF NOT EXISTS idx_tasks_department ON tasks(department)');

  await client.query(`ALTER PUBLICATION supabase_realtime ADD TABLE tasks`).catch(() => console.log('realtime already enabled'));

  console.log('Schema created successfully');
  await client.end();
  process.exit(0);
}

main().catch((e) => { console.error('error:', e.message); process.exit(1); });
