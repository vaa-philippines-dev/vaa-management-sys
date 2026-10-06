// One-time move of the DMF import's keys from bare RECORD NO to
// department + RECORD NO (lib/sync/dmf-import.ts's dmfMappingKey /
// dmfAssignmentExternalId). Every department's sheet numbers its own rows,
// so a bare "260" in Amazon and in PPC are different engagements; keyed by
// the number alone, PPC's import attached 9 of its rows to Amazon's
// assignments (see scripts/repair-dmf-ppc-collision.ts).
//
// Each existing key takes the department of the assignment it points at
// (its client's department) — the department whose import created it.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/dmf-scope-record-keys.ts            (dry run)
//   npx tsx --env-file=.env.local scripts/dmf-scope-record-keys.ts --apply    (writes)
// Re-running is safe: keys already in the new form are skipped.
import { prisma } from '@/lib/prisma'
import { logAuditWrite } from '@/lib/audit'
import { DMF_SOURCE, dmfAssignmentExternalId, dmfMappingKey, getSystemActorId } from '@/lib/sync/dmf-import'

const LEGACY_ASSIGNMENT_ID = /^DMF-(\d+)$/

async function main() {
  const apply = process.argv.includes('--apply')

  const mappings = await prisma.externalSyncMapping.findMany({
    where: { source: DMF_SOURCE, entityType: 'ASSIGNMENT', NOT: { externalId: { contains: ':' } } },
    select: { id: true, externalId: true, internalId: true },
  })
  const assignments = await prisma.assignment.findMany({
    where: { source: 'DMF_SYNC', externalId: { startsWith: 'DMF-' } },
    select: { id: true, externalId: true, client: { select: { departmentId: true, department: { select: { name: true } } } } },
  })
  const byId = new Map(assignments.map((a) => [a.id, a]))

  const mappingMoves: { id: string; from: string; to: string }[] = []
  const skipped: string[] = []
  for (const m of mappings) {
    const deptId = byId.get(m.internalId)?.client.departmentId
    if (!deptId) {
      skipped.push(`mapping ${m.externalId} → ${m.internalId}: assignment or its department not found`)
      continue
    }
    mappingMoves.push({ id: m.id, from: m.externalId, to: dmfMappingKey(deptId, m.externalId) })
  }

  const assignmentMoves: { id: string; from: string; to: string }[] = []
  for (const a of assignments) {
    const legacy = a.externalId?.match(LEGACY_ASSIGNMENT_ID)
    if (!legacy) continue
    if (!a.client.departmentId) {
      skipped.push(`assignment ${a.externalId}: client has no department`)
      continue
    }
    assignmentMoves.push({ id: a.id, from: a.externalId!, to: dmfAssignmentExternalId(a.client.departmentId, legacy[1]) })
  }

  const perDept = new Map<string, number>()
  for (const m of mappings) {
    const name = byId.get(m.internalId)?.client.department?.name ?? '(none)'
    perDept.set(name, (perDept.get(name) ?? 0) + 1)
  }

  console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — scoping DMF record keys by department`)
  console.log(`  mappings to re-key:    ${mappingMoves.length} (${[...perDept].map(([d, n]) => `${d} ${n}`).join(', ')})`)
  console.log(`  assignment ids to re-key: ${assignmentMoves.length}`)
  for (const m of mappingMoves.slice(0, 3)) console.log(`    e.g. mapping ${m.from} → ${m.to}`)
  for (const a of assignmentMoves.slice(0, 3)) console.log(`    e.g. assignment ${a.from} → ${a.to}`)
  if (skipped.length) {
    console.log(`  skipped (${skipped.length}):`)
    for (const s of skipped) console.log(`    - ${s}`)
  }

  if (!apply) {
    console.log('\nDry run only — nothing was written. Re-run with --apply.')
    return
  }

  // Two set-based statements (same rules as the preview above): ~1,000
  // single-row updates over the pooled connection outran the transaction
  // timeout.
  const [mappingCount, assignmentCount] = await prisma.$transaction([
    prisma.$executeRaw`
      UPDATE external_sync_mappings m
      SET external_id = c.department_id || ':' || m.external_id, updated_at = now()
      FROM assignments a JOIN clients c ON c.id = a.client_id
      WHERE m.internal_id = a.id AND m.source = ${DMF_SOURCE} AND m.entity_type = 'ASSIGNMENT'
        AND position(':' in m.external_id) = 0 AND c.department_id IS NOT NULL`,
    prisma.$executeRaw`
      UPDATE assignments a
      SET external_id = 'DMF-' || c.department_id || '-' || substring(a.external_id from 5), updated_at = now()
      FROM clients c
      WHERE c.id = a.client_id AND a.source = 'DMF_SYNC' AND a.external_id ~ '^DMF-[0-9]+$' AND c.department_id IS NOT NULL`,
  ])
  if (mappingCount !== mappingMoves.length || assignmentCount !== assignmentMoves.length) {
    console.warn(`Expected ${mappingMoves.length}/${assignmentMoves.length}, updated ${mappingCount}/${assignmentCount}`)
  }

  const actorId = await getSystemActorId()
  await logAuditWrite(
    assignmentMoves.map((a) => ({
      actorId,
      action: 'UPDATE',
      entityType: 'Assignment',
      entityId: a.id,
      before: { externalId: a.from },
      after: { externalId: a.to },
      metadata: { source: 'dmf-scope-record-keys' },
    }))
  )
  console.log(`\nDone: ${mappingMoves.length} mappings and ${assignmentMoves.length} assignment ids re-keyed.`)
}

main()
  .catch((e) => {
    console.error('Failed:', e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
