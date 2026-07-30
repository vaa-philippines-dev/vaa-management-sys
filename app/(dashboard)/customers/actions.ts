'use server'

import { requireRole } from '@/lib/auth'
import { logAudit } from '@/lib/audit'
import { revalidatePath } from 'next/cache'
import { fetchCustomersRows, fetchAccountsRows } from '@/lib/google/customers-accounts-sheet'
import { loadCmsCustomersAndAccounts, type CmsSyncSummary } from '@/lib/sync/customers-accounts'

const CMS_SYNC_ROLES = ['SUPER_ADMIN', 'SYSTEM_ADMIN', 'EXECUTIVE']

export type CmsSyncPreview = { customerRows: number; accountRows: number }

export async function previewCmsSync(): Promise<CmsSyncPreview> {
  await requireRole(...CMS_SYNC_ROLES)

  const [customers, accounts] = await Promise.all([fetchCustomersRows(), fetchAccountsRows()])
  return { customerRows: customers.length, accountRows: accounts.length }
}

export async function runCmsSync(): Promise<CmsSyncSummary> {
  const actor = await requireRole(...CMS_SYNC_ROLES)

  const summary = await loadCmsCustomersAndAccounts()

  await logAudit({
    actorId: actor.id,
    action: 'UPDATE',
    entityType: 'CmsSync',
    entityId: 'cms_sync',
    metadata: summary,
  })

  revalidatePath('/customers')
  revalidatePath('/accounts')

  return summary
}
