// Fills a staff member's empty UserProfile fields (the Staff 201's Personal
// Information / Employment & Payment sections) from their latest Staff
// Masterlist row. Only blank fields are written — anything already on the
// profile (e.g. from VA onboarding) wins over the sheet.
//
//   npx tsx --env-file=.env.local scripts/backfill-staff-profiles.ts           (dry run)
//   npx tsx --env-file=.env.local scripts/backfill-staff-profiles.ts --apply   (writes)
import { prisma } from '@/lib/prisma'
import { getStaffPeople } from '@/lib/staff'

// The sheet writes emergency contacts as "09993451780 | Jophel Mendoza".
function splitEmergency(raw: string | null): { phone: string | null; name: string | null } {
  if (!raw) return { phone: null, name: null }
  const [a, b] = raw.split('|').map((s) => s.trim())
  const isPhone = (s?: string) => !!s && /^[\d\s()+-]{7,}$/.test(s)
  if (isPhone(a)) return { phone: a, name: b || null }
  if (isPhone(b)) return { phone: b, name: a || null }
  return { phone: null, name: raw.trim() }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const people = (await getStaffPeople()).filter((p) => p.latest.userId)

  let touched = 0
  for (const p of people) {
    const userId = p.latest.userId!
    const full = await prisma.staffRecord.findUnique({ where: { id: p.latest.id } })
    if (!full) continue
    const profile = await prisma.userProfile.findUnique({ where: { userId } })
    const emergency = splitEmergency(full.emergencyContact)

    const candidate = {
      workEmail: full.workEmail,
      personalEmail: full.personalEmail,
      whatsappNumber: full.whatsapp,
      gcashNumber: full.gcash,
      birthDate: full.birthDate,
      address: full.address,
      emergencyContactPhone: emergency.phone,
      emergencyContactName: emergency.name,
    }
    const data = Object.fromEntries(
      Object.entries(candidate).filter(([k, v]) => v != null && (profile?.[k as keyof typeof candidate] ?? null) == null)
    )
    if (!Object.keys(data).length) continue
    touched++
    console.log(`${p.name}: ${Object.keys(data).join(', ')}`)
    if (apply) {
      await prisma.userProfile.upsert({
        where: { userId },
        create: { userId, ...data, nonCelebrant: full.nonCelebrant },
        update: data,
      })
    }
  }
  console.log(`\n${touched} of ${people.length} linked staff ${apply ? 'updated' : 'would be updated'}.`)
  if (!apply) console.log('Dry run — re-run with --apply to write.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
