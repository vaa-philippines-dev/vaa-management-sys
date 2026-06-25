const { Client } = require('pg');
(async () => {
  const c = new Client({ connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres' });
  await c.connect();
  // Check our public tables specifically
  const r = await c.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('users','va_profiles','tasks') ORDER BY table_name, ordinal_position");
  for (const row of r.rows) {
    console.log(row.table_name + ' → ' + row.column_name + ' (' + row.data_type + ')');
  }
  await c.end();
})();
