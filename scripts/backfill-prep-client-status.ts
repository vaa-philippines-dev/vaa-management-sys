// One-time cleanup after Phase ZX (scripts/run-phase-zx-migration.js), which
// made VA Preparation's VA STATUS WITH CLIENT blank-able. Until then every row
// read "Active" whether or not anyone said so: the schema default, the edit
// form (no blank option) and the DMF import (blank or unrecognized cell →
// ACTIVE) all filled it in. This clears the ones that were only ever
// defaulted, then applies the new rule — blank until VA Connect is Done, then
// Active effective the VA Connect date.
//
// A row keeps ACTIVE when its DMF sheet cell literally says "Active". Only the
// sheet can tell that apart from a default, so this re-reads each
// department's "VA Preparation" tab (DMF_SHEETS in lib/google/dmf-sheet.ts).
// Rows the sheet doesn't cover (created in the app) had no way to be anything
// but Active, so they're treated as defaulted too.
//
// It also turns the legacy VA BUFFERS text into buffer rows where a name
// matches exactly one VA in the department; unmatched names stay as text.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/backfill-prep-client-status.ts            (dry run)
//   npx tsx --env-file=.env.local scripts/backfill-prep-client-status.ts --apply    (writes)
// --apply first saves every row it will touch to a JSON backup in the OS temp
// directory (path printed), so the previous values can be restored.
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'
import { DMF_SHEETS, fetchDmfTabRows } from '@/lib/google/dmf-sheet'
import { DMF_SOURCE, getSystemActorId, splitBufferNames } from '@/lib/sync/dmf-import'
import { buildDmfIndexes, matchName } from '@/lib/sync/dmf-match'
import { resolveClientStatus } from '@/lib/va-preparation-fields'
import type { PreparationClientStatus } from '@/src/generated/prisma/enums'

type Change = {
  preparationId: string
  label: string
  reason: string
  before: { clientStatus: PreparationClientStatus | null; effectivityDate: Date | null }
  after: { clientStatus: PreparationClientStatus | null; effectivityDate: Date | null }
}

async function main() {
  const apply = process.argv.includes('--apply')

  const mappings = await prisma.externalSyncMapping.findMany({
    where: { source: DMF_SOURCE, entityType: 'ASSIGNMENT' },
    select: { externalId: true, internalId: true },
  })
  const assignmentByRecordNo = new Map(mappings.map((m) => [m.externalId, m.internalId]))

  const preparations = await prisma.assignmentPreparation.findMany({
    select: {
      id: true,
      assignmentId: true,
      clientStatus: true,
      effectivityDate: true,
      vaConnectStatus: true,
      vaConnectDate: true,
      vaBuffers: true,
      assignment: {
        select: {
          client: { select: { name: true, departmentId: true, department: { select: { name: true } } } },
          vaProfile: { select: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
    },
  })
  const prepByAssignment = new Map(preparations.map((p) => [p.assignmentId, p]))
  const label = (p: (typeof preparations)[number]) =>
    `${p.assignment.vaProfile.user.firstName} ${p.assignment.vaProfile.user.lastName} — ${p.assignment.client.name}`

  // Raw VA STATUS WITH CLIENT per assignment. RECORD NO is only unique within
  // one department's sheet (PPC and Amazon reuse numbers), so a row is only
  // trusted when the mapped assignment belongs to that sheet's department.
  const sheetStatus = new Map<string, string>()
  for (const [departmentName, sheetId] of Object.entries(DMF_SHEETS)) {
    if (!sheetId) continue
    const rows = await fetchDmfTabRows(sheetId, 'VA Preparation', 3)
    let used = 0
    for (const row of rows) {
      const assignmentId = assignmentByRecordNo.get(row['RECORD NO'] ?? '')
      const prep = assignmentId ? prepByAssignment.get(assignmentId) : undefined
      if (!prep || prep.assignment.client.department?.name !== departmentName) continue
      if (!sheetStatus.has(prep.assignmentId)) {
        sheetStatus.set(prep.assignmentId, (row['VA STATUS WITH CLIENT'] ?? '').trim())
        used++
      }
    }
    console.log(`${departmentName}: read ${rows.length} sheet rows, ${used} matched to a preparation`)
  }

  const changes: Change[] = []
  const counts = { keptExplicitActive: 0, keptActiveByVaConnect: 0, cleared: 0, clearedUnrecognized: 0 }
  for (const p of preparations) {
    if (p.clientStatus !== 'ACTIVE') continue
    const raw = sheetStatus.get(p.assignmentId)
    const before = { clientStatus: p.clientStatus, effectivityDate: p.effectivityDate }

    if (raw !== undefined && raw.toLowerCase() === 'active') {
      counts.keptExplicitActive++
      continue
    }
    if (raw) {
      // "Resigned", "Replaced", … — the old import's fallback turned these
      // into Active. There's no safe status to guess, so they go blank for a
      // manager to set, and the VA Connect rule is NOT applied to them.
      counts.clearedUnrecognized++
      changes.push({ preparationId: p.id, label: label(p), reason: `sheet says "${raw}"`, before, after: { clientStatus: null, effectivityDate: p.effectivityDate } })
      continue
    }

    const after = resolveClientStatus({
      clientStatus: null,
      effectivityDate: p.effectivityDate,
      vaConnectStatus: p.vaConnectStatus,
      vaConnectDate: p.vaConnectDate,
      fallbackDate: null,
    })
    if (after.clientStatus === 'ACTIVE') {
      counts.keptActiveByVaConnect++
      if (after.effectivityDate?.getTime() !== p.effectivityDate?.getTime()) {
        changes.push({ preparationId: p.id, label: label(p), reason: 'VA Connect done — effectivity set to VA Connect date', before, after })
      }
    } else {
      counts.cleared++
      changes.push({
        preparationId: p.id,
        label: label(p),
        reason: raw === undefined ? 'not in the DMF sheet (app default)' : 'blank in the DMF sheet, VA Connect not done',
        before,
        after,
      })
    }
  }

  // Legacy VA BUFFERS text → buffer rows.
  const bufferWrites: { preparationId: string; label: string; vaProfileIds: string[]; leftover: string | null }[] = []
  const indexesByDept = new Map<string, Awaited<ReturnType<typeof buildDmfIndexes>>>()
  for (const p of preparations) {
    const departmentId = p.assignment.client.departmentId
    if (!p.vaBuffers || !departmentId) continue
    if (!indexesByDept.has(departmentId)) indexesByDept.set(departmentId, await buildDmfIndexes(departmentId))
    const index = indexesByDept.get(departmentId)!.vaByName
    const ids: string[] = []
    const leftover: string[] = []
    for (const name of splitBufferNames(p.vaBuffers)) {
      const m = matchName(index, name)
      if (!m.id) leftover.push(name)
      else if (!ids.includes(m.id)) ids.push(m.id)
    }
    if (ids.length > 0) bufferWrites.push({ preparationId: p.id, label: label(p), vaProfileIds: ids, leftover: leftover.join(', ') || null })
    else console.log(`  buffers left as text (no VA match): ${label(p)} → "${p.vaBuffers}"`)
  }

  console.log('\nVA STATUS WITH CLIENT, rows currently Active:')
  console.log(`  kept — sheet explicitly says Active: ${counts.keptExplicitActive}`)
  console.log(`  kept — VA Connect done:              ${counts.keptActiveByVaConnect}`)
  console.log(`  cleared — defaulted, VA Connect not done: ${counts.cleared}`)
  console.log(`  cleared — sheet had an unrecognized value: ${counts.clearedUnrecognized}`)
  for (const c of changes.filter((c) => c.after.clientStatus === null && c.reason.startsWith('sheet says'))) {
    console.log(`    - ${c.label}: ${c.reason}`)
  }
  console.log(`  rows to write: ${changes.length}`)
  console.log(`VA buffers matched to VAs: ${bufferWrites.length}`)
  for (const b of bufferWrites) console.log(`    - ${b.label}: ${b.vaProfileIds.length} VA(s), leftover text: ${b.leftover ?? '—'}`)

  if (!apply) {
    console.log('\nDry run — nothing written. Re-run with --apply to write.')
    return
  }

  const backupPath = path.join(tmpdir(), `prep-client-status-backup-${Date.now()}.json`)
  writeFileSync(backupPath, JSON.stringify({ changes, bufferWrites }, null, 2))
  console.log(`\nBackup written to ${backupPath}`)

  const actorId = await getSystemActorId()
  for (const c of changes) {
    await prisma.assignmentPreparation.update({ where: { id: c.preparationId }, data: c.after })
    await logAudit({
      actorId,
      action: 'UPDATE',
      entityType: 'AssignmentPreparation',
      entityId: c.preparationId,
      before: { clientStatus: c.before.clientStatus, effectivityDate: c.before.effectivityDate?.toISOString() ?? null },
      after: { clientStatus: c.after.clientStatus, effectivityDate: c.after.effectivityDate?.toISOString() ?? null },
      metadata: { source: 'backfill-prep-client-status', reason: c.reason },
    })
  }
  for (const b of bufferWrites) {
    await prisma.$transaction([
      prisma.assignmentPreparationBuffer.deleteMany({ where: { preparationId: b.preparationId } }),
      prisma.assignmentPreparationBuffer.createMany({
        data: b.vaProfileIds.map((vaProfileId, sortOrder) => ({ preparationId: b.preparationId, vaProfileId, sortOrder })),
      }),
      prisma.assignmentPreparation.update({ where: { id: b.preparationId }, data: { vaBuffers: b.leftover } }),
    ])
  }
  console.log(`Wrote ${changes.length} status change(s) and ${bufferWrites.length} buffer set(s).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
