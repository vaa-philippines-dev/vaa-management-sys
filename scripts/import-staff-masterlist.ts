// One-time backfill of the "VAA | STAFF MASTERLIST" sheet, exported as CSV,
// into staff_records (plus the account conversions/creations described in
// lib/sync/staff-masterlist-import.ts).
//
// Usage (--env-file, not dotenv, for the same reason as scripts/import-dmf.ts):
//   npx tsx --env-file=.env.local scripts/import-staff-masterlist.ts --file <path.csv>           (dry run)
//   npx tsx --env-file=.env.local scripts/import-staff-masterlist.ts --file <path.csv> --apply   (writes)
//
// The dry run only reads the database. --apply needs the Phase ZW migration
// (scripts/run-phase-zw-migration.js) to have created staff_records first.
import { readFileSync } from 'fs'
import { prisma } from '@/lib/prisma'
import { parseStaffCsv, planStaffImport, applyStaffImport, type PersonPlan } from '@/lib/sync/staff-masterlist-import'

function list(title: string, items: string[], limit = 200) {
  console.log(`\n${title} (${items.length})`)
  for (const i of items.slice(0, limit)) console.log(`  - ${i}`)
  if (items.length > limit) console.log(`  ...and ${items.length - limit} more`)
}

const describe = (p: PersonPlan) =>
  `${p.name} [${p.latest.position ?? 'no position'} · ${p.latest.generalStatus ?? 'no status'}${p.rows.length > 1 ? ` · ${p.rows.length} rows` : ''}]`

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const fileIndex = args.indexOf('--file')
  const file = fileIndex >= 0 ? args[fileIndex + 1] : null
  if (!file) {
    console.error('Usage: npx tsx --env-file=.env.local scripts/import-staff-masterlist.ts --file <path.csv> [--apply]')
    process.exit(1)
  }

  const rows = parseStaffCsv(readFileSync(file, 'utf8'))
  const plan = await planStaffImport(rows)
  const by = (kind: PersonPlan['action']['kind']) => plan.people.filter((p) => p.action.kind === kind)

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${rows.length} sheet rows, ${plan.people.length} people`)

  list('Convert VA account → internal staff', by('convert').map((p) => {
    const a = p.action as Extract<PersonPlan['action'], { kind: 'convert' }>
    return `${describe(p)} — ${a.user.email} (${a.user.systemRole} → ${a.newRole}), matched by ${p.matchedBy}`
  }))
  list('Link to existing account, no change', by('link').map((p) => {
    const a = p.action as Extract<PersonPlan['action'], { kind: 'link' }>
    return `${describe(p)} — ${a.user.email} (${a.user.userType}/${a.user.systemRole}): ${a.reason}, matched by ${p.matchedBy}`
  }))
  list('Create new STAFF account', by('create').map((p) => {
    const a = p.action as Extract<PersonPlan['action'], { kind: 'create' }>
    return `${describe(p)} — ${a.email}`
  }))
  list('Staff record only, no account', by('record-only').map((p) => {
    const a = p.action as Extract<PersonPlan['action'], { kind: 'record-only' }>
    return `${describe(p)} — ${a.reason}`
  }))
  list('Ambiguous', plan.ambiguous.map((i) => `${i.name}: ${i.reason}`))
  list('Warnings', plan.warnings.map((i) => `${i.name}: ${i.reason}`))
  const badDates = rows.filter((r) => !r.hireDate && !r.startDate)
  list('Rows with no hire or start date', badDates.map((r) => `row ${r.sheetRow}: ${r.firstName} ${r.lastName ?? ''}`), 30)

  if (apply) {
    await applyStaffImport(plan)
    console.log('\nDone.')
  } else {
    console.log('\nDry run — nothing written. Re-run with --apply to write.')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
