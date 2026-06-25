/**
 * Google Sheets mock — writes task data to a local JSON file instead of a real sheet.
 * Replace this file with the real `lib/google/sheets.ts` (using googleapis SDK)
 * when your company grants Google API access.
 *
 * Output:
 *   .google-mock/sheet-sync.json   — the full task spreadsheet as an array of rows
 *   .google-mock/sheet-sync.csv    — same data in CSV format (easier to inspect)
 */
import * as fs from 'node:fs'
import * as path from 'node:path'
import { prisma } from '@/lib/prisma'
import type { Task } from '@/src/generated/prisma/client'

const SYNC_FILE = path.join(process.cwd(), '.google-mock', 'sheet-sync.json')
const CSV_FILE = path.join(process.cwd(), '.google-mock', 'sheet-sync.csv')

function escapeCsv(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export async function syncTasksToSheet() {
  const tasks = await prisma.task.findMany({
    include: {
      assignedTo: { include: { user: true } },
      assignedBy: true,
    },
    orderBy: { createdAt: 'desc' },
  })

  const dir = path.dirname(SYNC_FILE)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  const header = ['Title', 'VA', 'Manager', 'Priority', 'Status', 'Due Date', 'Department', 'Drive Folder']
  const rows = tasks.map((t: Task & { assignedTo: { user: { name: string | null; email: string } }; assignedBy: { name: string | null; email: string } }) => [
    t.title,
    t.assignedTo.user.name || t.assignedTo.user.email,
    t.assignedBy.name || t.assignedBy.email,
    t.priority,
    t.status,
    t.dueDate?.toISOString().split('T')[0] ?? '',
    t.department ?? '',
    t.googleDriveFolder ?? '',
  ])

  const jsonData = [header, ...rows]
  fs.writeFileSync(SYNC_FILE, JSON.stringify(jsonData, null, 2))
  console.log(`[Mock Sheets] Synced ${rows.length} tasks to ${SYNC_FILE}`)

  const csvLines = [header, ...rows].map((row) => row.map(escapeCsv).join(','))
  fs.writeFileSync(CSV_FILE, csvLines.join('\n'))
  console.log(`[Mock Sheets] CSV written to ${CSV_FILE}`)
}
