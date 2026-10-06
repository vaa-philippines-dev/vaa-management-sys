// One-time backfill from a department's DMF Google Sheet into VA
// Preparation / Performance Monitoring / VA Availability / Projects.
//
// Usage (--env-file loads .env.local before any module evaluates — required
// here, unlike in the Next.js app itself, because several imported modules
// read process.env at their own top level: lib/prisma.ts's client and
// DMF_SHEETS below. A plain `import 'dotenv/config'` at the top of this file
// would run too late — ES module evaluation runs every imported module's
// top-level code, in dependency order, before this file's own body, so
// lib/prisma.ts would already have read an empty DATABASE_URL by the time
// a dotenv.config() call written here executed):
//   npx tsx --env-file=.env.local scripts/import-dmf.ts --department Amazon           (dry run)
//   npx tsx --env-file=.env.local scripts/import-dmf.ts --department Amazon --apply   (writes)
//
// --records 260,279 limits it to those RECORD NOs (VA Preparation and
// Performance Monitoring only); --all prints every listed row instead of
// the first 30 per section.
//
// Always run without --apply first and read the report. Re-running with
// --apply is safe (every write is an upsert or an update, matched rows are
// cached, Projects are deduped by name+date) but the report is where a bad
// name match gets caught before it touches the database.
import { prisma } from '@/lib/prisma'
import { DMF_AVAILABILITY_TABS, DMF_SHEETS } from '@/lib/google/dmf-sheet'
import { runDmfImport, type ImportSummary } from '@/lib/sync/dmf-import'

const LIMIT = process.argv.includes('--all') ? Infinity : 30

function printSummary(s: ImportSummary) {
  console.log(`\n=== ${s.tab} ===`)
  console.log(`  rows read:        ${s.totalRows}`)
  console.log(`  matched:          ${s.matched}`)
  if (s.created) console.log(`  assignments created: ${s.created}`)
  console.log(`  changed:          ${s.changed}`)
  if (s.unchanged) console.log(`  already imported: ${s.unchanged}`)
  if (s.wouldCreate.length) {
    console.log(`  would create (${s.wouldCreate.length}):`)
    for (const i of s.wouldCreate.slice(0, LIMIT)) console.log(`    - ${i.label}: ${i.reason}`)
    if (s.wouldCreate.length > LIMIT) console.log(`    ...and ${s.wouldCreate.length - LIMIT} more`)
  }
  if (s.joined.length) {
    console.log(`  hybrid VAs added to this department (${s.joined.length}):`)
    for (const i of s.joined.slice(0, LIMIT)) console.log(`    - ${i.label}: ${i.reason}`)
    if (s.joined.length > LIMIT) console.log(`    ...and ${s.joined.length - LIMIT} more`)
  }
  if (s.unmatched.length) {
    console.log(`  unmatched (${s.unmatched.length}):`)
    for (const i of s.unmatched.slice(0, LIMIT)) console.log(`    - ${i.label}: ${i.reason}`)
    if (s.unmatched.length > LIMIT) console.log(`    ...and ${s.unmatched.length - LIMIT} more`)
  }
  if (s.ambiguous.length) {
    console.log(`  ambiguous (${s.ambiguous.length}):`)
    for (const i of s.ambiguous) console.log(`    - ${i.label}: ${i.reason}`)
  }
  if (s.warnings.length) {
    console.log(`  warnings (${s.warnings.length}):`)
    for (const i of s.warnings.slice(0, LIMIT)) console.log(`    - ${i.label}: ${i.reason}`)
    if (s.warnings.length > LIMIT) console.log(`    ...and ${s.warnings.length - LIMIT} more`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const apply = args.includes('--apply')
  const deptIndex = args.indexOf('--department')
  const departmentName = deptIndex >= 0 ? args[deptIndex + 1] : null
  const recordsIndex = args.indexOf('--records')
  const records = recordsIndex >= 0 ? new Set(args[recordsIndex + 1].split(',').map((r) => r.trim()).filter(Boolean)) : null

  if (!departmentName) {
    console.error('Usage: npx tsx scripts/import-dmf.ts --department <name> [--apply]')
    process.exit(1)
  }

  const sheetId = DMF_SHEETS[departmentName]
  if (!sheetId) {
    console.error(
      `No DMF sheet configured for "${departmentName}". Known: ${Object.keys(DMF_SHEETS).join(', ')} — add it to DMF_SHEETS in lib/google/dmf-sheet.ts.`
    )
    process.exit(1)
  }

  const department = await prisma.department.findFirst({ where: { name: departmentName } })
  if (!department) {
    console.error(`No department named "${departmentName}" in this database.`)
    process.exit(1)
  }

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — importing DMF sheet for ${departmentName} (department ${department.id})`)

  if (records) console.log(`Only RECORD NO ${[...records].join(', ')}`)
  const summaries = await runDmfImport(sheetId, department.id, apply, {
    records,
    availabilityTab: DMF_AVAILABILITY_TABS[departmentName],
  })
  summaries.forEach(printSummary)

  if (!apply) {
    console.log('\nDry run only — nothing was written. Re-run with --apply once this report looks right.')
  }
}

main()
  .catch((e) => {
    console.error('Import failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
