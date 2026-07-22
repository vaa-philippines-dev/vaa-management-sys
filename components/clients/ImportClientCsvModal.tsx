'use client'

import { useMemo, useRef, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { UploadCloud, FileText, X, Download, Minus, ChevronDown, ChevronUp } from 'lucide-react'
import { toast } from 'sonner'
import type { ClientCsvRow } from '@/app/(dashboard)/clients/actions'
import { useClientCsvImport } from '@/components/clients/ClientCsvImportContext'
import { INTAKE_FIELD_CATALOG, getIntakeFieldsForDepartment, type IntakeFieldKey } from '@/lib/clients/intake-fields'

export type ImportDepartmentOption = { id: string; name: string; shortName: string | null; acronym: string | null }

// Same character-stream CSV parser as the VA Roster importer — handles
// quoted multi-line cells (e.g. a long "account background" note) without
// shredding columns at an embedded newline.
function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []
  let cells: string[] = []
  let current = ''
  let inQuotes = false
  let sawAnyContentOnLine = false

  const endCell = () => { cells.push(current); current = '' }
  const endRecord = () => {
    endCell()
    if (cells.some((c) => c.trim().length > 0)) records.push(cells.map((c) => c.trim()))
    cells = []
    sawAnyContentOnLine = false
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') { current += '"'; i++ }
      else if (char === '"') { inQuotes = false }
      else { current += char }
      continue
    }
    if (char === '"') { inQuotes = true; sawAnyContentOnLine = true }
    else if (char === ',') { endCell(); sawAnyContentOnLine = true }
    else if (char === '\r') { /* skip, \n (or EOF) ends the record */ }
    else if (char === '\n') { if (sawAnyContentOnLine || current) endRecord() }
    else { current += char; sawAnyContentOnLine = true }
  }
  if (sawAnyContentOnLine || current || cells.length > 0) endRecord()

  return records
}

type BaseClientCsvField = 'name' | 'platform' | 'contactName' | 'contactEmail' | 'contactPhone' | 'industry' | 'timezone' | 'website' | 'managerEmail' | 'status' | 'onHold' | 'requiredSkills' | 'notes' | 'onboardingFolderUrl'

const BASE_COLUMN_ALIASES: Record<BaseClientCsvField, string[]> = {
  name: ['name', 'client name', 'client', 'account'],
  platform: ['platform'],
  contactName: ['contactname', 'contact name', 'contact person', 'point of contact', 'poc'],
  contactEmail: ['contactemail', 'contact email', 'email', 'email address'],
  contactPhone: ['contactphone', 'contact phone', 'phone', 'phone number', 'whatsapp', 'mobile'],
  industry: ['industry', 'niche'],
  timezone: ['timezone', 'time zone'],
  website: ['website', 'website url', 'url'],
  managerEmail: ['manageremail', 'manager email', 'manager', 'account manager'],
  status: ['status', 'client status', 'account status'],
  onHold: ['onhold', 'on hold', 'hold status'],
  requiredSkills: ['requiredskills', 'required skills', 'services', 'skills needed'],
  notes: ['notes', 'remarks', 'comments'],
  onboardingFolderUrl: ['onboardingfolderurl', 'onboarding folder', 'onboarding folder url', 'drive folder'],
}

// A "masterlist"-style sheet (e.g. one row per VA assignment rather than per
// client) often has no dedicated Client name column — the client's identity
// lives in a company-name column and/or a primary-contact-person column
// instead. These are checked in addition to the generic `name` alias above.
// This is deliberately not tied to any one department's exact wording, since
// different departments' sheets phrase these differently.
const COMPANY_NAME_ALIASES = ['company name', 'company', 'business name', 'brand name']
const PRIMARY_ACCOUNT_ALIASES = ['primary account', 'account name', 'client contact']
// Business-model/service text (e.g. "Wholesale", "Walmart Wholesale",
// "Arbitrage VA", "PPC Campaign") is used to infer platform only when
// there's no explicit platform column — never overrides a real platform
// column, and only sets a platform when a marketplace keyword is actually
// found in that text (see parseCsvRows below) rather than assuming one.
const BUSINESS_MODEL_ALIASES = ['business model', 'account type', 'engagement type']
const SERVICE_TEXT_ALIASES = ['service', 'type', 'service type', 'campaign type']

// Free-text columns that don't map to a first-class Client field but
// shouldn't be silently dropped — folded into `notes`, each labeled so the
// source is still legible.
const NOTES_SOURCE_COLUMNS: { label: string; aliases: string[] }[] = [
  { label: 'Company/Client Background', aliases: ['company / client background', 'company/client background'] },
  { label: 'Product Background/Niche', aliases: ['product background / niche', 'product background/niche'] },
  { label: 'Product & Links', aliases: ['product and links', 'product & links'] },
  { label: 'Brand/s', aliases: ['brand/s', 'brands'] },
  { label: 'Brand Ownership', aliases: ['brand ownership'] },
  { label: 'Brand Registration', aliases: ['brand registration'] },
  { label: 'Marketplace/s', aliases: ['marketplace/s', 'marketplaces'] },
  { label: 'Limitations', aliases: ['limitations'] },
  { label: 'Additional Notes', aliases: ['additional notes'] },
]

const INTAKE_FIELD_KEYS = Object.keys(INTAKE_FIELD_CATALOG) as IntakeFieldKey[]

// Precedence used to collapse one client's several source rows (e.g. one row
// per VA ever assigned to that account) into a single client-level status:
// as long as ANY row for that client is Active, the client counts as Active
// overall — a departed VA's row showing EOC shouldn't demote a still-live
// account. Blank/unrecognized text sits at the lowest tier so it never wins
// over a real signal from another row.
function statusTier(raw: string): number {
  const t = raw.trim().toUpperCase()
  if (!t) return 4
  if (t === 'ACTIVE') return 0
  if (t === 'PAUSED') return 1
  if (t === 'PENDING') return 2
  return 3 // EOC, CANCELLED, or anything else
}

function normalizeNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

function firstNonBlank(group: ClientCsvRow[], key: keyof ClientCsvRow): string | undefined {
  for (const r of group) {
    const v = r[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return undefined
}

function pickWinningStatus(group: ClientCsvRow[]): string | undefined {
  let best: { text: string; tier: number } | null = null
  for (const r of group) {
    const raw = (r.status || '').trim()
    if (!raw) continue
    const tier = statusTier(raw)
    if (!best || tier < best.tier) best = { text: raw, tier }
  }
  return best?.text
}

// Groups raw sheet rows by resolved client name and merges each group into
// one row. A no-op for a clean sheet where every row is already a distinct
// client (each group ends up size 1).
function collapseRowsByClient(rawRows: ClientCsvRow[]): ClientCsvRow[] {
  const groups = new Map<string, ClientCsvRow[]>()
  const order: string[] = []
  for (const r of rawRows) {
    const key = normalizeNameKey(r.name)
    if (!key) continue
    if (!groups.has(key)) { groups.set(key, []); order.push(key) }
    groups.get(key)!.push(r)
  }

  const passthroughFields: (keyof ClientCsvRow)[] = [
    'contactName', 'contactEmail', 'contactPhone', 'industry', 'timezone',
    'website', 'managerEmail', 'requiredSkills', 'onboardingFolderUrl', 'platform', 'onHold',
  ]

  return order.map((key) => {
    const group = groups.get(key)!
    const merged: ClientCsvRow = { name: firstNonBlank(group, 'name') || group[0].name }

    for (const field of passthroughFields) {
      const v = firstNonBlank(group, field)
      if (v !== undefined) (merged as Record<string, unknown>)[field] = v
    }

    const status = pickWinningStatus(group)
    if (status !== undefined) merged.status = status

    for (const intakeKey of INTAKE_FIELD_KEYS) {
      const values = Array.from(new Set(group.map((r) => (r[intakeKey] || '').trim()).filter(Boolean)))
      if (values.length > 0) merged[intakeKey] = values.join('\n\n')
    }

    const notesValues = Array.from(new Set(group.map((r) => (r.notes || '').trim()).filter(Boolean)))
    if (notesValues.length > 0) merged.notes = notesValues.join('\n\n')

    return merged
  })
}

function parseCsvRows(text: string): ClientCsvRow[] {
  const records = parseCsvRecords(text)
  if (records.length === 0) return []

  const header = records[0].map((h) => h.toLowerCase())
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h))
  const cell = (cells: string[], i: number) => (i !== -1 ? cells[i] : undefined)

  const baseIdx = Object.fromEntries(
    (Object.keys(BASE_COLUMN_ALIASES) as BaseClientCsvField[]).map((key) => [key, idx(...BASE_COLUMN_ALIASES[key])])
  ) as Record<BaseClientCsvField, number>

  const intakeIdx = Object.fromEntries(
    INTAKE_FIELD_KEYS.map((key) => [key, idx(key.toLowerCase(), INTAKE_FIELD_CATALOG[key].label.toLowerCase())])
  ) as Record<IntakeFieldKey, number>

  const companyNameIdx = idx(...COMPANY_NAME_ALIASES)
  const primaryAccountIdx = idx(...PRIMARY_ACCOUNT_ALIASES)
  const businessModelIdx = idx(...BUSINESS_MODEL_ALIASES)
  const serviceTextIdx = idx(...SERVICE_TEXT_ALIASES)
  const notesSourceIdx = NOTES_SOURCE_COLUMNS.map((col) => idx(...col.aliases))

  const hasNameSource = baseIdx.name !== -1 || companyNameIdx !== -1 || primaryAccountIdx !== -1
  if (!hasNameSource) return []

  return records.slice(1).map((cells) => {
    const directName = cell(cells, baseIdx.name)
    const companyName = cell(cells, companyNameIdx)
    const primaryAccount = cell(cells, primaryAccountIdx)
    const resolvedName = [directName, companyName, primaryAccount].find((v) => v && v.trim()) || ''

    const row: ClientCsvRow = { name: resolvedName }

    for (const key of Object.keys(BASE_COLUMN_ALIASES) as BaseClientCsvField[]) {
      if (key === 'name') continue
      const value = cell(cells, baseIdx[key])
      if (value !== undefined) (row as Record<string, unknown>)[key] = value
    }
    // A "primary account" column is the contact person even when it also
    // ended up supplying the client's display name (company name blank).
    if (!row.contactName && primaryAccount && primaryAccount.trim()) row.contactName = primaryAccount

    for (const key of INTAKE_FIELD_KEYS) {
      const value = cell(cells, intakeIdx[key])
      if (value !== undefined) row[key] = value
    }

    const notesParts: string[] = []
    const baseNotes = cell(cells, baseIdx.notes)
    if (baseNotes && baseNotes.trim()) notesParts.push(baseNotes.trim())
    NOTES_SOURCE_COLUMNS.forEach((col, i) => {
      const value = cell(cells, notesSourceIdx[i])
      if (value && value.trim()) notesParts.push(`${col.label}: ${value.trim()}`)
    })
    if (notesParts.length > 0) row.notes = notesParts.join('\n')

    // Only inferred when the sheet actually has business-model/service-type
    // columns (i.e. looks like an assignment masterlist) and no explicit
    // platform column — never overrides a real platform value. Purely
    // keyword-driven: a department whose sheet doesn't mention any
    // marketplace at all (e.g. a non-marketplace service line) should fall
    // through to the server's own MULTI default rather than being guessed
    // as Amazon just because this happens to be common for one department.
    if (baseIdx.platform === -1 && (businessModelIdx !== -1 || serviceTextIdx !== -1)) {
      const modelText = `${cell(cells, businessModelIdx) || ''} ${cell(cells, serviceTextIdx) || ''}`
      if (/walmart/i.test(modelText)) row.platform = 'WALMART'
      else if (/tiktok/i.test(modelText)) row.platform = 'TIKTOK_SHOP'
      else if (/shopify/i.test(modelText)) row.platform = 'SHOPIFY'
      else if (/amazon/i.test(modelText)) row.platform = 'AMAZON'
    }

    return row
  })
}

function parseCsv(text: string): { rows: ClientCsvRow[]; sourceRowCount: number } {
  const rawRows = parseCsvRows(text)
  const collapsed = collapseRowsByClient(rawRows)
  return { rows: collapsed, sourceRowCount: rawRows.length }
}

function ColumnReference({ intakeKeys }: { intakeKeys: IntakeFieldKey[] }) {
  const [open, setOpen] = useState(false)
  const baseColumns = Object.keys(BASE_COLUMN_ALIASES).filter((k) => k !== 'name')

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-xs font-medium hover:bg-muted/40 transition-colors"
      >
        <span>Column reference</span>
        {open ? (
          <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}
      </button>
      {open && (
        <div className="border-t px-3 py-3 space-y-3 max-h-56 overflow-y-auto">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">General</p>
            <div className="flex flex-wrap gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-1.5 py-0.5 text-[11px] font-mono" title="required">
                name<span className="text-muted-foreground font-sans">· required (or Company Name / Primary Account)</span>
              </span>
              {baseColumns.map((name) => (
                <span key={name} className="inline-flex items-center gap-1 rounded-md border bg-muted/30 px-1.5 py-0.5 text-[11px] font-mono">
                  {name}
                </span>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              This department&apos;s intake fields
            </p>
            {intakeKeys.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">Select a department above to see its fields.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {intakeKeys.map((key) => (
                  <span key={key} className="inline-flex items-center gap-1 rounded-md border bg-primary/5 border-primary/20 px-1.5 py-0.5 text-[11px] font-mono">
                    {key}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            If your sheet has multiple rows for the same client (e.g. one row per VA ever assigned to that account), they&apos;re
            automatically merged into a single client record. The status kept is whichever is most &quot;alive&quot; across that
            client&apos;s rows: Active &gt; Paused &gt; Pending &gt; EOC/Cancelled.
          </p>
        </div>
      )}
    </div>
  )
}

export function ImportClientCsvModal({ departments }: { departments: ImportDepartmentOption[] }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [departmentId, setDepartmentId] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<ClientCsvRow[]>([])
  const [sourceRowCount, setSourceRowCount] = useState(0)
  const { state: importState, startImport, minimize, cancelImport, closeModal, reset: resetImport } = useClientCsvImport()
  const open = importState.modalOpen

  const isRunning = importState.status === 'running'
  const isDone = importState.status === 'done' || importState.status === 'cancelled'

  const selectedDepartment = departments.find((d) => d.id === departmentId)
  const intakeKeys = useMemo(() => getIntakeFieldsForDepartment(selectedDepartment), [selectedDepartment])

  const reset = () => {
    setDepartmentId('')
    setFileName(null)
    setRows([])
    setSourceRowCount(0)
    resetImport()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    const buffer = await file.arrayBuffer()
    // Excel on Windows exports CSVs as Windows-1252/ANSI, not UTF-8 — decoding
    // that as UTF-8 mangles accented characters, so detect the corruption and
    // re-decode as Windows-1252 (same fix as the VA Roster importer).
    let text = new TextDecoder('utf-8').decode(buffer)
    if (text.includes('�')) {
      text = new TextDecoder('windows-1252').decode(buffer)
    }
    const { rows: parsed, sourceRowCount: srcCount } = parseCsv(text)
    if (parsed.length === 0) {
      toast.error('Could not find a name, company name, or primary account column, or file is empty')
      return
    }
    setFileName(file.name)
    setRows(parsed)
    setSourceRowCount(srcCount)
  }

  const handleImport = () => {
    if (!selectedDepartment) return
    startImport(fileName ?? 'import.csv', selectedDepartment.id, selectedDepartment.name, rows)
  }

  const handleClose = () => {
    if (isRunning) {
      minimize()
      return
    }
    reset()
    closeModal()
  }

  const handleDownloadTemplate = () => {
    const headers = ['name', ...Object.keys(BASE_COLUMN_ALIASES).filter((k) => k !== 'name'), ...intakeKeys]
    const sampleRow: Record<string, string> = {
      name: 'Sample Client Inc.',
      platform: 'AMAZON',
      contactName: 'Jane Doe',
      contactEmail: 'jane@sampleclient.com',
      contactPhone: '09171234567',
      industry: 'E-commerce',
      timezone: 'America/New_York',
      website: 'https://sampleclient.com',
      managerEmail: '',
      status: 'ACTIVE',
      onHold: 'false',
      requiredSkills: 'Amazon Expert;Customer Service',
      notes: 'Sample row — replace or delete me',
      onboardingFolderUrl: '',
    }
    for (const key of intakeKeys) sampleRow[key] = `Sample ${INTAKE_FIELD_CATALOG[key].label.toLowerCase()}`

    const csvContent = [
      headers.join(','),
      headers.map((h) => `"${(sampleRow[h] ?? '').replace(/"/g, '""')}"`).join(','),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `client-import-template${selectedDepartment ? `-${selectedDepartment.name.toLowerCase().replace(/\s+/g, '-')}` : ''}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="Import Clients from CSV"
      description="Pick the department this sheet belongs to — its intake form fields are matched automatically by column name."
      size="md"
      footer={
        <>
          {isRunning ? (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleClose}>
                <Minus className="h-3.5 w-3.5 mr-1.5" />
                Minimize
              </Button>
              <Button type="button" variant="destructive" size="sm" className="h-8" onClick={cancelImport}>
                Cancel Import
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleClose}>
                {isDone ? 'Close' : 'Cancel'}
              </Button>
              {!isDone && (
                <Button type="button" size="sm" className="h-8" disabled={rows.length === 0 || !departmentId} onClick={handleImport}>
                  Import {rows.length > 0 ? `${rows.length} Client${rows.length === 1 ? '' : 's'}` : ''}
                </Button>
              )}
            </>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {(isRunning || isDone) ? (
          <div className="space-y-2">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${isDone ? (importState.status === 'cancelled' ? 'bg-warning' : 'bg-success') : 'bg-primary'}`}
                style={{ width: `${importState.totalRows > 0 ? Math.round((importState.processedRows / importState.totalRows) * 100) : 0}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {importState.fileName}{importState.departmentName ? ` · ${importState.departmentName}` : ''} · {importState.processedRows}/{importState.totalRows} rows
              {importState.status === 'cancelled' && ' · cancelled'}
            </p>
            <p className="text-sm">
              <span className="font-medium text-success">{importState.created} created</span>
              {importState.updated > 0 && (
                <span className="font-medium text-info"> · {importState.updated} updated</span>
              )}
              {importState.skipped.length > 0 && (
                <span className="text-muted-foreground"> · {importState.skipped.length} skipped</span>
              )}
            </p>
            {isDone && importState.skipped.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <ul className="text-[11px] divide-y">
                  {importState.skipped.map((s, i) => (
                    <li key={i} className="px-2 py-1.5 text-muted-foreground">
                      {s.row === -1 ? 'Chunk error' : `Row ${s.row}`}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs font-medium">Department</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full px-2.5 py-1.5 text-sm border rounded-md bg-background h-9"
              >
                <option value="">Select a department…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-muted-foreground">
                Every client in this file is created under this department. Blank cells never overwrite existing data on re-import.
              </p>
            </div>

            {!fileName && (
              <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={handleDownloadTemplate} disabled={!departmentId}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download CSV Template
              </Button>
            )}

            {!fileName && <ColumnReference intakeKeys={intakeKeys} />}

            {!fileName ? (
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-lg p-8 cursor-pointer hover:bg-muted/40 transition-colors">
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
                <span className="text-sm font-medium">Click to select a CSV file</span>
                <span className="text-[11px] text-muted-foreground">or drag and drop</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleFile(file)
                  }}
                />
              </label>
            ) : (
              <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{fileName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {sourceRowCount} sheet row{sourceRowCount === 1 ? '' : 's'}
                      {sourceRowCount !== rows.length && ` → ${rows.length} unique client${rows.length === 1 ? '' : 's'}`}
                    </p>
                  </div>
                </div>
                <button type="button" onClick={() => { setFileName(null); setRows([]); setSourceRowCount(0); if (fileInputRef.current) fileInputRef.current.value = '' }} className="p-1 hover:bg-accent rounded shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {rows.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-2 py-1.5 font-medium">Name</th>
                      <th className="text-left px-2 py-1.5 font-medium">Contact</th>
                      <th className="text-left px-2 py-1.5 font-medium">Platform</th>
                      <th className="text-left px-2 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 20).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1 truncate max-w-[160px]">{r.name || <span className="text-muted-foreground">—</span>}</td>
                        <td className="px-2 py-1 text-muted-foreground truncate max-w-[160px]">{r.contactEmail || r.contactName || '—'}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.platform || '—'}</td>
                        <td className="px-2 py-1 text-muted-foreground">{r.status || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 20 && (
                  <p className="text-[11px] text-muted-foreground text-center py-1.5 bg-muted/30">
                    + {rows.length - 20} more row{rows.length - 20 === 1 ? '' : 's'}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
