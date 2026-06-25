const { Client } = require('pg');
async function main() {
  const c = new Client({ connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres' });
  await c.connect();
  await c.query('DROP TABLE IF EXISTS tasks, va_profiles, "va_profiles", users CASCADE');
  await c.query('DROP TYPE IF EXISTS "UserRole", "TaskPriority", "TaskStatus" CASCADE');
  console.log('dropped old schema');
  await c.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
