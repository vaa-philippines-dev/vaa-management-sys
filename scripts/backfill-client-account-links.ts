// Links existing Client (Client Assignment) rows to the Account they belong
// to, now that Customers/Accounts have been synced from the CMS.
//
// Usage:
//   npx tsx scripts/backfill-client-account-links.ts            (dry run — no writes)
//   npx tsx scripts/backfill-client-account-links.ts --commit    (writes the matches)
//
// Matching, in priority order, on normalized name (lowercase, trimmed,
// whitespace-collapsed, trailing "."/"," stripped):
//   1. Client.name vs Account.accountName  — identifies one specific account directly.
//   2. Client.name vs Account.companyName  — identifies one specific account directly.
//   3. Client.name vs Account.customerName — only identifies the *customer*, not
//      which of their accounts, so this tier only auto-links when that
//      customer owns exactly one Account (otherwise it's genuinely ambiguous
//      which account the assignment belongs to).
// A name that matches more than one distinct account at the same tier is
// also left unmatched — guessing wrong here is worse than not linking.

import 'dotenv/config'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const COMMIT = process.argv.includes('--commit')

function normalize(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[.,]+$/g, '')
    .trim()
}

async function main() {
  const { prisma } = await import('../lib/prisma')

  const [clients, accounts] = await Promise.all([
    prisma.client.findMany({ where: { accountId: null }, select: { id: true, name: true } }),
    prisma.account.findMany({ select: { id: true, accountName: true, companyName: true, customerName: true, customerId: true } }),
  ])

  // Ambiguity surface, printed up front regardless of dry-run/commit.
  const accountsPerCustomer = new Map<string, number>()
  for (const a of accounts) {
    if (!a.customerId) continue
    accountsPerCustomer.set(a.customerId, (accountsPerCustomer.get(a.customerId) ?? 0) + 1)
  }
  const multiAccountCustomers = Array.from(accountsPerCustomer.values()).filter((n) => n > 1).length

  const nameCounts = new Map<string, number>()
  for (const a of accounts) {
    const key = normalize(a.accountName || '')
    if (!key) continue
    nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1)
  }
  const sharedAccountNames = Array.from(nameCounts.values()).filter((n) => n > 1).length

  console.log('=== Ambiguity surface ===')
  console.log(`Customers with >1 account: ${multiAccountCustomers} / ${accountsPerCustomer.size}`)
  console.log(`Account names shared by >1 account: ${sharedAccountNames}`)
  console.log()

  // Build lookup maps: normalized name -> set of distinct account ids.
  function buildMap(pick: (a: (typeof accounts)[number]) => string | null): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>()
    for (const a of accounts) {
      const raw = pick(a)
      if (!raw) continue
      const key = normalize(raw)
      if (!key) continue
      if (!map.has(key)) map.set(key, new Set())
      map.get(key)!.add(a.id)
    }
    return map
  }
  const byAccountName = buildMap((a) => a.accountName)
  const byCompanyName = buildMap((a) => a.companyName)
  const byCustomerName = buildMap((a) => a.customerName)
  const accountById = new Map(accounts.map((a) => [a.id, a]))

  type Outcome = { clientId: string; clientName: string; accountId: string | null; reason: string }
  const matched: Outcome[] = []
  const ambiguous: Outcome[] = []
  const unmatched: Outcome[] = []

  for (const client of clients) {
    const key = normalize(client.name)
    if (!key) {
      unmatched.push({ clientId: client.id, clientName: client.name, accountId: null, reason: 'blank name' })
      continue
    }

    const byAccount = byAccountName.get(key)
    if (byAccount && byAccount.size === 1) {
      const accountId = [...byAccount][0]
      matched.push({ clientId: client.id, clientName: client.name, accountId, reason: 'accountName' })
      continue
    }
    if (byAccount && byAccount.size > 1) {
      ambiguous.push({ clientId: client.id, clientName: client.name, accountId: null, reason: `${byAccount.size} accounts share this accountName` })
      continue
    }

    const byCompany = byCompanyName.get(key)
    if (byCompany && byCompany.size === 1) {
      const accountId = [...byCompany][0]
      matched.push({ clientId: client.id, clientName: client.name, accountId, reason: 'companyName' })
      continue
    }
    if (byCompany && byCompany.size > 1) {
      ambiguous.push({ clientId: client.id, clientName: client.name, accountId: null, reason: `${byCompany.size} accounts share this companyName` })
      continue
    }

    const byCustomer = byCustomerName.get(key)
    if (byCustomer && byCustomer.size === 1) {
      const accountId = [...byCustomer][0]
      const account = accountById.get(accountId)!
      const customerAccountCount = account.customerId ? accountsPerCustomer.get(account.customerId) ?? 1 : 1
      if (customerAccountCount === 1) {
        matched.push({ clientId: client.id, clientName: client.name, accountId, reason: 'customerName (sole account)' })
      } else {
        ambiguous.push({ clientId: client.id, clientName: client.name, accountId: null, reason: `customer has ${customerAccountCount} accounts, name-only match can't tell which` })
      }
      continue
    }
    if (byCustomer && byCustomer.size > 1) {
      ambiguous.push({ clientId: client.id, clientName: client.name, accountId: null, reason: `${byCustomer.size} accounts share this customerName` })
      continue
    }

    unmatched.push({ clientId: client.id, clientName: client.name, accountId: null, reason: 'no matching account' })
  }

  console.log('=== Results ===')
  console.log(`Total unlinked Client Assignments: ${clients.length}`)
  console.log(`Matched: ${matched.length}`)
  console.log(`Ambiguous (skipped): ${ambiguous.length}`)
  console.log(`Unmatched (skipped): ${unmatched.length}`)
  console.log()

  console.log('--- Sample matches (first 15) ---')
  for (const m of matched.slice(0, 15)) console.log(`  "${m.clientName}" -> account ${m.accountId} (via ${m.reason})`)

  console.log('--- Sample ambiguous (first 15) ---')
  for (const a of ambiguous.slice(0, 15)) console.log(`  "${a.clientName}": ${a.reason}`)

  console.log('--- Sample unmatched (first 15) ---')
  for (const u of unmatched.slice(0, 15)) console.log(`  "${u.clientName}"`)

  if (!COMMIT) {
    console.log()
    console.log('Dry run only — no writes made. Re-run with --commit to apply the matched links.')
    await prisma.$disconnect()
    return
  }

  console.log()
  console.log(`Committing ${matched.length} links...`)
  for (const m of matched) {
    await prisma.client.update({ where: { id: m.clientId }, data: { accountId: m.accountId } })
  }
  console.log('Done.')
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
