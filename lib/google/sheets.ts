/**
 * Google Sheets mock — writes work log data to a local JSON file instead of a real sheet.
 * Replace this file with the real `lib/google/sheets.ts` (using googleapis SDK)
 * when your company grants Google API access.
 *
 * Output:
 *   .google-mock/sheet-sync.json   — the spreadsheet as an array of rows
 *   .google-mock/sheet-sync.csv    — same data in CSV format (easier to inspect)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { prisma } from '@/lib/prisma'

const SYNC_FILE = path.join(process.cwd(), '.google-mock', 'sheet-sync.json')
const CSV_FILE = path.join(process.cwd(), '.google-mock', 'sheet-sync.csv')

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function syncWorkLogsToSheet() {
  const logs = await prisma.workLog.findMany({
    include: {
      assignment: { include: { client: true } },
      vaProfile: { include: { user: true } },
    },
    orderBy: { workDate: 'desc' },
  })

  const dir = path.dirname(SYNC_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const header = ['Date', 'Client', 'VA', 'Hours', 'Description']
  const rows = logs.map((l) => [
    l.workDate.toISOString().split('T')[0],
    l.assignment.client.name,
    l.vaProfile.user.name || l.vaProfile.user.email,
    Number(l.hours).toFixed(2),
    l.description ?? '',
  ])

  const jsonData = [header, ...rows]
  fs.writeFileSync(SYNC_FILE, JSON.stringify(jsonData, null, 2))
  console.log(`[Mock Sheets] Synced ${rows.length} work logs to ${SYNC_FILE}`)

  const csvLines = [header, ...rows].map((row) => row.map(escapeCsv).join(','))
  fs.writeFileSync(CSV_FILE, csvLines.join('\n'))
  console.log(`[Mock Sheets] CSV written to ${CSV_FILE}`)
}