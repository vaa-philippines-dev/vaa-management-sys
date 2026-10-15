// One-off (2026-10-15): link VAs whose imported vaaPosition text names no
// Service to the Service the user picked for it, so the Masterlist and the
// profile's VAA Position picker read the same thing. "(External)" moves into
// Type of VA — only where it is still the default REGULAR, so a type set
// in-app is never overwritten. "Virtual Assistant" is deliberately left as
// text (too vague to map). Each change is audit-logged with the old text.
//
// Usage:
//   npx tsx --env-file=.env.local scripts/map-legacy-va-positions.ts --actor <email>          (dry run)
//   npx tsx --env-file=.env.local scripts/map-legacy-va-positions.ts --actor <email> --apply  (writes)
import { prisma } from '@/lib/prisma'
import { logAuditWrite } from '@/lib/audit'
import type { VAType } from '@/src/generated/prisma/enums'

// Old position text → Service short name (+ Type of VA it implies).
const MAPPING: Record<string, { service: string; vaType?: VAType }> = {
  'Graphic Designer VA': { service: 'Graphics Designer VA' },
  'Graphic Designer': { service: 'Graphics Designer VA' },
  'Design Quality Assurance VA': { service: 'Quality Assurance VA' },
  'Video Editor': { service: 'Video Editor VA' },
  'Customer Service Representative': { service: 'Customer Service Representative VA' },
  'Amazon VA (External)': { service: 'Amazon VA', vaType: 'EXPERIENCED_EXTERNAL' },
  'Amazon VA (External - Japanese Support)': { service: 'Amazon VA', vaType: 'EXPERIENCED_EXTERNAL' },
  'Social Media VA (External)': { service: 'Social Media VA', vaType: 'EXPERIENCED_EXTERNAL' },
  'Senior Amz VA (External)': { service: 'Amazon VA', vaType: 'SENIOR_EXTERNAL' },
}

async function main() {
  const apply = process.argv.includes('--apply')
  const actorEmail = process.argv[process.argv.indexOf('--actor') + 1]
  if (!process.argv.includes('--actor') || !actorEmail) throw new Error('--actor <email> is required')
  const actor = await prisma.user.findUnique({ where: { email: actorEmail }, select: { id: true } })
  if (!actor) throw new Error(`No user ${actorEmail}`)

  const skills = await prisma.skill.findMany({ select: { id: true, name: true, shortName: true } })
  const skillByShortName = new Map(skills.map((s) => [s.shortName ?? s.name, s]))
  for (const { service } of Object.values(MAPPING)) {
    if (!skillByShortName.has(service)) throw new Error(`No Service with short name "${service}"`)
  }

  const profiles = await prisma.vAProfile.findMany({
    where: { vaaPosition: { in: Object.keys(MAPPING) } },
    select: { id: true, vaaPosition: true, positionSkillId: true, vaType: true },
  })

  const summary = new Map<string, { n: number; typeSet: number; typeKept: number }>()
  const updates = profiles.map((p) => {
    const rule = MAPPING[p.vaaPosition!]
    const skill = skillByShortName.get(rule.service)!
    const setType = rule.vaType && p.vaType === 'REGULAR' ? rule.vaType : undefined
    const row = summary.get(p.vaaPosition!) ?? { n: 0, typeSet: 0, typeKept: 0 }
    row.n++
    if (setType) row.typeSet++
    else if (rule.vaType) row.typeKept++
    summary.set(p.vaaPosition!, row)
    return {
      id: p.id,
      before: { vaaPosition: p.vaaPosition, positionSkillId: p.positionSkillId, ...(setType && { vaType: p.vaType }) },
      after: { vaaPosition: rule.service, positionSkillId: skill.id, ...(setType && { vaType: setType }) },
    }
  })

  console.table(
    [...summary].map(([from, s]) => ({
      from,
      to: MAPPING[from].service,
      vas: s.n,
      typeSet: MAPPING[from].vaType ? `${s.typeSet} → ${MAPPING[from].vaType}` : '',
      typeAlreadySet: s.typeKept || '',
    })),
  )
  console.log(`${updates.length} VA profile(s) ${apply ? 'updating' : 'would update'}.`)
  if (!apply) return console.log('Dry run — re-run with --apply to write.')

  for (const u of updates) {
    await prisma.vAProfile.update({ where: { id: u.id }, data: u.after })
  }
  await logAuditWrite(
    updates.map((u) => ({
      actorId: actor.id,
      action: 'UPDATE',
      entityType: 'VAProfile',
      entityId: u.id,
      before: u.before,
      after: u.after,
      metadata: { fields: Object.keys(u.after), source: 'scripts/map-legacy-va-positions.ts' },
    })),
  )
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
