// One-time repair of the PPC DMF import (2026-09-17). Keyed by bare RECORD
// NO, it found these 9 PPC record numbers already mapped — to Amazon's
// rows with the same numbers — and wrote PPC's data onto those Amazon
// assignments instead of creating PPC ones:
//   - VA Preparation fields and buffers overwritten on all 9;
//   - KPI M6 marked complete on 5 (260, 279, 507, 546, 592);
//   - a W2 client-feedback row added to 580.
// The import never audited its preparation updates, so there are no
// "before" values to restore. Instead this:
//   1. undoes the KPI/feedback writes, identified by the PPC run's
//      timestamps (no one has touched them since — checked before writing this);
//   2. re-imports those 9 rows from Amazon's own sheet onto their Amazon
//      assignments, as the Amazon import originally did;
//   3. imports the 9 PPC rows into PPC, creating their own assignments.
// Run scripts/dmf-scope-record-keys.ts --apply first; this relies on it.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/repair-dmf-ppc-collision.ts            (dry run)
//   npx tsx --env-file=.env.local scripts/repair-dmf-ppc-collision.ts --apply    (writes)
import { prisma } from '@/lib/prisma'
import { logAuditWrite } from '@/lib/audit'
import { DMF_SHEETS } from '@/lib/google/dmf-sheet'
import { DMF_SOURCE, dmfMappingKey, getSystemActorId, runDmfImport, type ImportSummary } from '@/lib/sync/dmf-import'

const RECORDS = ['260', '279', '507', '546', '580', '591', '592', '609', '617']
// The PPC import's writes all landed between 06:17 and 06:27 UTC on Sep 17;
// the Amazon import ran at 11:36–12:03 UTC the day before.
const PPC_RUN = { from: new Date('2026-09-17T06:00:00Z'), to: new Date('2026-09-17T07:00:00Z') }

function print(s: ImportSummary) {
  console.log(`  ${s.tab}: ${s.totalRows} rows, ${s.matched} matched, ${s.created} created, ${s.changed} changes`)
  for (const i of [...s.wouldCreate, ...s.unmatched, ...s.ambiguous]) console.log(`    - ${i.label}: ${i.reason}`)
  for (const i of s.warnings) console.log(`    ! ${i.label}: ${i.reason}`)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const [amazon, ppc] = await Promise.all([
    prisma.department.findFirstOrThrow({ where: { name: 'Amazon' }, select: { id: true } }),
    prisma.department.findFirstOrThrow({ where: { name: 'PPC' }, select: { id: true } }),
  ])

  const mappings = await prisma.externalSyncMapping.findMany({
    where: { source: DMF_SOURCE, entityType: 'ASSIGNMENT', externalId: { in: RECORDS.map((r) => dmfMappingKey(amazon.id, r)) } },
    select: { externalId: true, internalId: true },
  })
  if (mappings.length !== RECORDS.length) {
    throw new Error(`Expected ${RECORDS.length} Amazon mappings, found ${mappings.length} — run scripts/dmf-scope-record-keys.ts --apply first.`)
  }
  const amazonAssignmentIds = mappings.map((m) => m.internalId)

  const [kpis, feedback, preps] = await Promise.all([
    prisma.assignmentKpiCheck.findMany({
      where: { assignmentId: { in: amazonAssignmentIds }, completed: true, completedById: null, updatedAt: { gte: PPC_RUN.from, lte: PPC_RUN.to } },
      select: { id: true, milestone: true, assignment: { select: { externalId: true } } },
    }),
    prisma.assignmentClientFeedback.findMany({
      where: { assignmentId: { in: amazonAssignmentIds }, createdAt: { gte: PPC_RUN.from, lte: PPC_RUN.to } },
    }),
    prisma.assignmentPreparation.findMany({
      where: { assignmentId: { in: amazonAssignmentIds } },
      select: { updatedAt: true, assignment: { select: { externalId: true } } },
    }),
  ])

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — repairing the PPC record-number collision (RECORD NO ${RECORDS.join(', ')})`)
  console.log(`\n1. Undo PPC writes on Amazon assignments`)
  for (const k of kpis) console.log(`  - ${k.assignment.externalId}: KPI ${k.milestone} back to not completed`)
  for (const f of feedback) console.log(`  - ${f.assignmentId}: delete ${f.window} feedback "${(f.feedback ?? '').slice(0, 40)}"`)
  const editedLater = preps.filter((p) => p.updatedAt > PPC_RUN.to)
  for (const p of editedLater) console.log(`  note: ${p.assignment.externalId} preparation changed after the PPC run (${p.updatedAt.toISOString()}) — re-import overwrites it`)

  if (apply) {
    const actorId = await getSystemActorId()
    await prisma.$transaction([
      prisma.assignmentKpiCheck.updateMany({ where: { id: { in: kpis.map((k) => k.id) } }, data: { completed: false } }),
      prisma.assignmentClientFeedback.deleteMany({ where: { id: { in: feedback.map((f) => f.id) } } }),
    ])
    await logAuditWrite([
      ...kpis.map((k) => ({
        actorId,
        action: 'UPDATE',
        entityType: 'AssignmentKpiCheck',
        entityId: k.id,
        before: { completed: true },
        after: { completed: false },
        metadata: { source: 'repair-dmf-ppc-collision', reason: 'set by the PPC import on an Amazon assignment' },
      })),
      ...feedback.map((f) => ({
        actorId,
        action: 'DELETE',
        entityType: 'AssignmentClientFeedback',
        entityId: f.id,
        before: { assignmentId: f.assignmentId, window: f.window, responseStatus: f.responseStatus, feedback: f.feedback },
        metadata: { source: 'repair-dmf-ppc-collision', reason: 'created by the PPC import on an Amazon assignment' },
      })),
    ])
  }

  const records = new Set(RECORDS)
  console.log(`\n2. Re-import these rows from Amazon's sheet onto their Amazon assignments`)
  for (const s of await runDmfImport(DMF_SHEETS.Amazon!, amazon.id, apply, { records })) print(s)

  console.log(`\n3. Import these rows from PPC's sheet into PPC`)
  for (const s of await runDmfImport(DMF_SHEETS.PPC!, ppc.id, apply, { records })) print(s)

  if (!apply) console.log('\nDry run only — nothing was written. Re-run with --apply.')
}

main()
  .catch((e) => {
    console.error('Failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
