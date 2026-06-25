const { Client } = require('pg');
const { randomUUID } = require('crypto');

async function main() {
  const c = new Client({ connectionString: 'postgresql://postgres.acdjmfbpgsuxxusniteg:Fi4C7jsPEw8gzPwb@aws-1-ap-southeast-2.pooler.supabase.com:5432/postgres' });
  await c.connect();
  console.log('connected, seeding...');

  const now = new Date().toISOString();

  await c.query(`INSERT INTO users (id, email, name, role, department, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=$3,role=$4,department=$5,"updatedAt"=$7`, ['mgr-1','manager@example.com','Alice Manager','MANAGER','Editorial',now,now]);

  await c.query(`INSERT INTO users (id, email, name, role, department, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=$3,department=$5,"updatedAt"=$7`, ['va-u1','va1@example.com','Bob Assistant','VA','Editorial',now,now]);
  await c.query(`INSERT INTO va_profiles (id, "userId", phone, hourly_rate, notes, is_active, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,true,$6,$7) ON CONFLICT ("userId") DO UPDATE SET phone=$3, hourly_rate=$4, notes=$5, "updatedAt"=$7`, ['va-p1','va-u1','+1-555-0101',25,'Content writing',now,now]);

  await c.query(`INSERT INTO users (id, email, name, role, department, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (email) DO UPDATE SET name=$3,department=$5,"updatedAt"=$7`, ['va-u2','va2@example.com','Carol Helper','VA','Editorial',now,now]);
  await c.query(`INSERT INTO va_profiles (id, "userId", phone, hourly_rate, notes, is_active, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,true,$6,$7) ON CONFLICT ("userId") DO UPDATE SET phone=$3, hourly_rate=$4, notes=$5, "updatedAt"=$7`, ['va-p2','va-u2','+1-555-0102',30,'Research & data entry',now,now]);

  const tasks = [
    ['Draft weekly newsletter','Write and format the weekly newsletter.','HIGH','IN_PROGRESS','2026-07-01','va-p1'],
    ['Research competitor blogs','Compile top 10 competitor blogs.','MEDIUM','TODO','2026-06-28','va-p2'],
    ['Update social media calendar','Plan next month posts.','LOW','BACKLOG',null,'va-p1'],
    ['Proofread Q3 report','Review grammar and formatting.','URGENT','REVIEW','2026-06-26','va-p2'],
    ['Organize Drive files','Clean up shared Drive folder.','LOW','DONE','2026-06-20','va-p1'],
  ];

  for (const [title, desc, priority, status, due, vaId] of tasks) {
    await c.query(
      `INSERT INTO tasks (id, title, description, priority, status, due_date, assigned_to_id, assigned_by_id, department, "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [randomUUID().slice(0,12), title, desc, priority, status, due, vaId, 'mgr-1', 'Editorial', now, now]
    );
  }

  console.log('Seed completed successfully');
  await c.end();
}

main().catch(e => { console.error(e.message); process.exit(1); });
