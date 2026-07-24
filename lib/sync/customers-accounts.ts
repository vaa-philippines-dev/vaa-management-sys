import { randomUUID } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { fetchCustomersRows, fetchAccountsRows, excelSerialToDate, type RawSheetRow } from '@/lib/google/customers-accounts-sheet'

const BATCH_SIZE = 200

function toStr(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s ? s : null
}

function toBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase()
    if (v === 'true' || v === 'yes') return true
    if (v === 'false' || v === 'no') return false
  }
  return null
}

function toInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

// ── Customers ────────────────────────────────────────────────────

export type CustomerLoadSummary = {
  totalRows: number
  upserted: number
  skippedBlankId: number
}

const CUSTOMER_COLUMNS = [
  'external_customer_id', 'name', 'status', 'status_date', 'assigned_specialist',
  'created_by_email', 'updated_by_email', 'notes', 'payment_date', 'no_payment_yet',
  'termination_count', 'reactivation_count', 'last_terminated_date', 'last_reactivated_date',
  'last_status_reason', 'status_history', 'cms_created_at', 'cms_updated_at', 'raw', 'last_synced_at',
] as const

type PreparedCustomer = {
  externalCustomerId: string
  name: string
  status: string | null
  statusDate: Date | null
  assignedSpecialist: string | null
  createdByEmail: string | null
  updatedByEmail: string | null
  notes: string | null
  paymentDate: Date | null
  noPaymentYet: boolean | null
  terminationCount: number | null
  reactivationCount: number | null
  lastTerminatedDate: Date | null
  lastReactivatedDate: Date | null
  lastStatusReason: string | null
  statusHistory: string | null
  cmsCreatedAt: Date | null
  cmsUpdatedAt: Date | null
  raw: RawSheetRow
  lastSyncedAt: Date
}

function prepareCustomerRow(row: RawSheetRow, externalCustomerId: string, now: Date): PreparedCustomer {
  return {
    externalCustomerId,
    name: toStr(row.CustomerName) ?? 'Unknown',
    status: toStr(row.Status),
    statusDate: excelSerialToDate(row.StatusDate),
    assignedSpecialist: toStr(row.AssignedSpecialist),
    createdByEmail: toStr(row.CreatedBy),
    updatedByEmail: toStr(row.UpdatedBy),
    notes: toStr(row.Notes),
    paymentDate: excelSerialToDate(row.PaymentDate),
    noPaymentYet: toBool(row.NoPaymentYet),
    terminationCount: toInt(row.TerminationCount),
    reactivationCount: toInt(row.ReactivationCount),
    lastTerminatedDate: excelSerialToDate(row.LastTerminatedDate),
    lastReactivatedDate: excelSerialToDate(row.LastReactivatedDate),
    lastStatusReason: toStr(row.LastStatusReason),
    statusHistory: toStr(row.StatusHistory),
    cmsCreatedAt: excelSerialToDate(row.CreatedAt),
    cmsUpdatedAt: excelSerialToDate(row.UpdatedAt),
    raw: row,
    lastSyncedAt: now,
  }
}

async function upsertCustomerBatch(batch: PreparedCustomer[]): Promise<void> {
  if (batch.length === 0) return

  const valuesSql: string[] = []
  const params: unknown[] = []

  batch.forEach((row) => {
    const values = [
      row.externalCustomerId, row.name, row.status, row.statusDate, row.assignedSpecialist,
      row.createdByEmail, row.updatedByEmail, row.notes, row.paymentDate, row.noPaymentYet,
      row.terminationCount, row.reactivationCount, row.lastTerminatedDate, row.lastReactivatedDate,
      row.lastStatusReason, row.statusHistory, row.cmsCreatedAt, row.cmsUpdatedAt,
      JSON.stringify(row.raw), row.lastSyncedAt,
    ]
    const base = params.length
    const placeholders = CUSTOMER_COLUMNS.map((col, i) => {
      const n = base + i + 1
      if (col === 'raw') return `$${n}::jsonb`
      return `$${n}`
    })
    valuesSql.push(`($${base + values.length + 1}, ${placeholders.join(', ')})`)
    params.push(...values, randomUUID())
  })

  const sql = `
    INSERT INTO "customers" (id, ${CUSTOMER_COLUMNS.join(', ')})
    VALUES ${valuesSql.join(', ')}
    ON CONFLICT (external_customer_id) DO UPDATE SET
      name = EXCLUDED.name,
      status = EXCLUDED.status,
      status_date = EXCLUDED.status_date,
      assigned_specialist = EXCLUDED.assigned_specialist,
      created_by_email = EXCLUDED.created_by_email,
      updated_by_email = EXCLUDED.updated_by_email,
      notes = EXCLUDED.notes,
      payment_date = EXCLUDED.payment_date,
      no_payment_yet = EXCLUDED.no_payment_yet,
      termination_count = EXCLUDED.termination_count,
      reactivation_count = EXCLUDED.reactivation_count,
      last_terminated_date = EXCLUDED.last_terminated_date,
      last_reactivated_date = EXCLUDED.last_reactivated_date,
      last_status_reason = EXCLUDED.last_status_reason,
      status_history = EXCLUDED.status_history,
      cms_created_at = EXCLUDED.cms_created_at,
      cms_updated_at = EXCLUDED.cms_updated_at,
      raw = EXCLUDED.raw,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = now()
  `
  await prisma.$executeRawUnsafe(sql, ...params)
}

async function loadCustomers(): Promise<CustomerLoadSummary> {
  const rows = await fetchCustomersRows()
  const summary: CustomerLoadSummary = { totalRows: rows.length, upserted: 0, skippedBlankId: 0 }
  const now = new Date()
  let batch: PreparedCustomer[] = []

  for (const row of rows) {
    const externalCustomerId = toStr(row.CustomerID)
    if (!externalCustomerId) {
      summary.skippedBlankId++
      continue
    }
    batch.push(prepareCustomerRow(row, externalCustomerId, now))
    summary.upserted++
    if (batch.length >= BATCH_SIZE) {
      await upsertCustomerBatch(batch)
      batch = []
    }
  }
  await upsertCustomerBatch(batch)

  return summary
}

// ── Accounts ─────────────────────────────────────────────────────

export type AccountLoadSummary = {
  totalRows: number
  upserted: number
  skippedBlankId: number
  unresolvedCustomer: number
}

const ACCOUNT_COLUMNS = [
  'external_account_id', 'external_customer_id', 'customer_id', 'customer_name', 'account_name',
  'primary_contact', 'secondary_contact', 'company_name', 'account_managers',
  'invoice_contact_name', 'invoice_contact_role', 'invoice_contact_email',
  'category', 'type', 'country_region', 'status', 'status_date', 'is_returning', 'notes',
  'primary_role', 'primary_email', 'primary_is_focal', 'secondary_role', 'secondary_email', 'secondary_is_focal',
  'primary_linked_to_customer', 'termination_reason', 'seller_onboarding_link', 'contract_id',
  'created_by_email', 'updated_by_email', 'cms_created_at', 'cms_updated_at', 'raw', 'last_synced_at',
] as const

type PreparedAccount = {
  externalAccountId: string
  externalCustomerId: string | null
  customerId: string | null
  customerName: string | null
  accountName: string | null
  primaryContact: string | null
  secondaryContact: string | null
  companyName: string | null
  accountManagers: string | null
  invoiceContactName: string | null
  invoiceContactRole: string | null
  invoiceContactEmail: string | null
  category: string | null
  type: string | null
  countryRegion: string | null
  status: string | null
  statusDate: Date | null
  isReturning: boolean | null
  notes: string | null
  primaryRole: string | null
  primaryEmail: string | null
  primaryIsFocal: boolean | null
  secondaryRole: string | null
  secondaryEmail: string | null
  secondaryIsFocal: boolean | null
  primaryLinkedToCustomer: boolean | null
  terminationReason: string | null
  sellerOnboardingLink: string | null
  contractId: string | null
  createdByEmail: string | null
  updatedByEmail: string | null
  cmsCreatedAt: Date | null
  cmsUpdatedAt: Date | null
  raw: RawSheetRow
  lastSyncedAt: Date
}

function prepareAccountRow(row: RawSheetRow, externalAccountId: string, customerIdMap: Map<string, string>, now: Date): PreparedAccount {
  const externalCustomerId = toStr(row.CustomerID)
  return {
    externalAccountId,
    externalCustomerId,
    customerId: externalCustomerId ? customerIdMap.get(externalCustomerId) ?? null : null,
    customerName: toStr(row['Customer Name']),
    accountName: toStr(row.AccountName),
    primaryContact: toStr(row.PrimaryContact),
    secondaryContact: toStr(row.SecondaryContact),
    companyName: toStr(row.CompanyName),
    accountManagers: toStr(row.AccountManagers),
    invoiceContactName: toStr(row.InvoiceContactName),
    invoiceContactRole: toStr(row.InvoiceContactRole),
    invoiceContactEmail: toStr(row.InvoiceContactEmail),
    category: toStr(row.Category),
    type: toStr(row.Type),
    countryRegion: toStr(row.CountryRegion),
    status: toStr(row.Status),
    statusDate: excelSerialToDate(row.StatusDate),
    isReturning: toBool(row.IsReturning),
    notes: toStr(row.Notes),
    primaryRole: toStr(row.PrimaryRole),
    primaryEmail: toStr(row.PrimaryEmail),
    primaryIsFocal: toBool(row.PrimaryIsFocal),
    secondaryRole: toStr(row.SecondaryRole),
    secondaryEmail: toStr(row.SecondaryEmail),
    secondaryIsFocal: toBool(row.SecondaryIsFocal),
    primaryLinkedToCustomer: toBool(row.PrimaryLinkedToCustomer),
    terminationReason: toStr(row.TerminationReason),
    sellerOnboardingLink: toStr(row.SellerOnboardingLink),
    contractId: toStr(row.ContractID),
    createdByEmail: toStr(row.CreatedBy),
    updatedByEmail: toStr(row.UpdatedBy),
    cmsCreatedAt: excelSerialToDate(row.CreatedAt),
    cmsUpdatedAt: excelSerialToDate(row.UpdatedAt),
    raw: row,
    lastSyncedAt: now,
  }
}

async function upsertAccountBatch(batch: PreparedAccount[]): Promise<void> {
  if (batch.length === 0) return

  const valuesSql: string[] = []
  const params: unknown[] = []

  batch.forEach((row) => {
    const values = [
      row.externalAccountId, row.externalCustomerId, row.customerId, row.customerName, row.accountName,
      row.primaryContact, row.secondaryContact, row.companyName, row.accountManagers,
      row.invoiceContactName, row.invoiceContactRole, row.invoiceContactEmail,
      row.category, row.type, row.countryRegion, row.status, row.statusDate, row.isReturning, row.notes,
      row.primaryRole, row.primaryEmail, row.primaryIsFocal, row.secondaryRole, row.secondaryEmail, row.secondaryIsFocal,
      row.primaryLinkedToCustomer, row.terminationReason, row.sellerOnboardingLink, row.contractId,
      row.createdByEmail, row.updatedByEmail, row.cmsCreatedAt, row.cmsUpdatedAt,
      JSON.stringify(row.raw), row.lastSyncedAt,
    ]
    const base = params.length
    const placeholders = ACCOUNT_COLUMNS.map((col, i) => {
      const n = base + i + 1
      if (col === 'raw') return `$${n}::jsonb`
      return `$${n}`
    })
    valuesSql.push(`($${base + values.length + 1}, ${placeholders.join(', ')})`)
    params.push(...values, randomUUID())
  })

  const sql = `
    INSERT INTO "accounts" (id, ${ACCOUNT_COLUMNS.join(', ')})
    VALUES ${valuesSql.join(', ')}
    ON CONFLICT (external_account_id) DO UPDATE SET
      external_customer_id = EXCLUDED.external_customer_id,
      customer_id = EXCLUDED.customer_id,
      customer_name = EXCLUDED.customer_name,
      account_name = EXCLUDED.account_name,
      primary_contact = EXCLUDED.primary_contact,
      secondary_contact = EXCLUDED.secondary_contact,
      company_name = EXCLUDED.company_name,
      account_managers = EXCLUDED.account_managers,
      invoice_contact_name = EXCLUDED.invoice_contact_name,
      invoice_contact_role = EXCLUDED.invoice_contact_role,
      invoice_contact_email = EXCLUDED.invoice_contact_email,
      category = EXCLUDED.category,
      type = EXCLUDED.type,
      country_region = EXCLUDED.country_region,
      status = EXCLUDED.status,
      status_date = EXCLUDED.status_date,
      is_returning = EXCLUDED.is_returning,
      notes = EXCLUDED.notes,
      primary_role = EXCLUDED.primary_role,
      primary_email = EXCLUDED.primary_email,
      primary_is_focal = EXCLUDED.primary_is_focal,
      secondary_role = EXCLUDED.secondary_role,
      secondary_email = EXCLUDED.secondary_email,
      secondary_is_focal = EXCLUDED.secondary_is_focal,
      primary_linked_to_customer = EXCLUDED.primary_linked_to_customer,
      termination_reason = EXCLUDED.termination_reason,
      seller_onboarding_link = EXCLUDED.seller_onboarding_link,
      contract_id = EXCLUDED.contract_id,
      created_by_email = EXCLUDED.created_by_email,
      updated_by_email = EXCLUDED.updated_by_email,
      cms_created_at = EXCLUDED.cms_created_at,
      cms_updated_at = EXCLUDED.cms_updated_at,
      raw = EXCLUDED.raw,
      last_synced_at = EXCLUDED.last_synced_at,
      updated_at = now()
  `
  await prisma.$executeRawUnsafe(sql, ...params)
}

async function loadAccounts(customerIdMap: Map<string, string>): Promise<AccountLoadSummary> {
  const rows = await fetchAccountsRows()
  const summary: AccountLoadSummary = { totalRows: rows.length, upserted: 0, skippedBlankId: 0, unresolvedCustomer: 0 }
  const now = new Date()
  let batch: PreparedAccount[] = []

  for (const row of rows) {
    const externalAccountId = toStr(row.ClientID)
    if (!externalAccountId) {
      summary.skippedBlankId++
      continue
    }
    const prepared = prepareAccountRow(row, externalAccountId, customerIdMap, now)
    if (prepared.externalCustomerId && !prepared.customerId) summary.unresolvedCustomer++
    batch.push(prepared)
    summary.upserted++
    if (batch.length >= BATCH_SIZE) {
      await upsertAccountBatch(batch)
      batch = []
    }
  }
  await upsertAccountBatch(batch)

  return summary
}

// ── Orchestration ────────────────────────────────────────────────

export type CmsSyncSummary = {
  customers: CustomerLoadSummary
  accounts: AccountLoadSummary
}

// Loads Customers first (Accounts reference them by CustomerID), then
// Accounts with customerId resolved from what's now in the customers table.
// Both phases are pure upserts — nothing is ever deleted, so a Customer or
// Account removed from the CMS just goes stale in our mirror rather than
// disappearing (acceptable for a manually-triggered, read-mostly mirror).
export async function loadCmsCustomersAndAccounts(): Promise<CmsSyncSummary> {
  const customers = await loadCustomers()

  const customerRows = await prisma.customer.findMany({ select: { id: true, externalCustomerId: true } })
  const customerIdMap = new Map(customerRows.map((c) => [c.externalCustomerId, c.id]))

  const accounts = await loadAccounts(customerIdMap)

  return { customers, accounts }
}
