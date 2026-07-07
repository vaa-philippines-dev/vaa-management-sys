'use client'

import { useRef, useState, useTransition } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { UploadCloud, Loader2, FileText, X, Download } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { bulkImportVAs, type VACsvRow, type VACsvImportResult } from '@/app/(dashboard)/vas/actions'

function parseCsv(text: string): VACsvRow[] {
  const lines = text.split(/\r\n|\n|\r/).filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []

  const parseLine = (line: string): string[] => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (inQuotes) {
        if (char === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (char === '"') { inQuotes = false }
        else { current += char }
      } else {
        if (char === '"') inQuotes = true
        else if (char === ',') { cells.push(current); current = '' }
        else current += char
      }
    }
    cells.push(current)
    return cells.map((c) => c.trim())
  }

  const header = parseLine(lines[0]).map((h) => h.toLowerCase())
  const idx = (...names: string[]) => header.findIndex((h) => names.includes(h))

  const nameIdx = idx('name', 'full name', 'fullname')
  const emailIdx = idx('email')
  const rateIdx = idx('hourlyrate', 'hourly rate', 'rate')
  const baseRateIdx = idx('baserate', 'base rate')
  const positionIdx = idx('vaaposition', 'position', 'vaa position')
  const levelIdx = idx('level')
  const departmentIdx = idx('department')
  const availabilityIdx = idx('availabilitystatus', 'availability status', 'availability')
  const statusIdx = idx('status', 'active status')
  const engagementIdx = idx('engagementstatus', 'engagement status')
  const hybridIdx = idx('hybrid')
  const preferredHoursIdx = idx('preferredworkhours', 'preferred work hours', 'preferred hours')
  const scheduleIdx = idx('availableschedule', 'available schedule', 'schedule')
  const phoneIdx = idx('phone')
  const personalEmailIdx = idx('personalemail', 'personal email')
  const workEmailIdx = idx('workemail', 'work email')
  const genderIdx = idx('gender')
  const birthDateIdx = idx('birthdate', 'birth date')
  const addressIdx = idx('address')
  const emergencyNameIdx = idx('emergencycontactname', 'emergency contact name')
  const emergencyPhoneIdx = idx('emergencycontactphone', 'emergency contact phone')
  const emergencyRelationIdx = idx('emergencycontactrelation', 'emergency contact relation')
  const facebookNameIdx = idx('facebookname', 'facebook name')
  const facebookUrlIdx = idx('facebookurl', 'facebook url')
  const linkedinIdx = idx('linkedinurl', 'linkedin url', 'linkedin')
  const notesIdx = idx('notes')

  if (nameIdx === -1) return []

  const cell = (cells: string[], i: number) => (i !== -1 ? cells[i] : undefined)

  return lines.slice(1).map((line) => {
    const cells = parseLine(line)
    return {
      name: cells[nameIdx] || '',
      email: cell(cells, emailIdx),
      hourlyRate: cell(cells, rateIdx),
      baseRate: cell(cells, baseRateIdx),
      vaaPosition: cell(cells, positionIdx),
      level: cell(cells, levelIdx),
      department: cell(cells, departmentIdx),
      availabilityStatus: cell(cells, availabilityIdx),
      status: cell(cells, statusIdx),
      engagementStatus: cell(cells, engagementIdx),
      hybrid: cell(cells, hybridIdx),
      preferredWorkHours: cell(cells, preferredHoursIdx),
      availableSchedule: cell(cells, scheduleIdx),
      phone: cell(cells, phoneIdx),
      personalEmail: cell(cells, personalEmailIdx),
      workEmail: cell(cells, workEmailIdx),
      gender: cell(cells, genderIdx),
      birthDate: cell(cells, birthDateIdx),
      address: cell(cells, addressIdx),
      emergencyContactName: cell(cells, emergencyNameIdx),
      emergencyContactPhone: cell(cells, emergencyPhoneIdx),
      emergencyContactRelation: cell(cells, emergencyRelationIdx),
      facebookName: cell(cells, facebookNameIdx),
      facebookUrl: cell(cells, facebookUrlIdx),
      linkedinUrl: cell(cells, linkedinIdx),
      notes: cell(cells, notesIdx),
    }
  })
}

export function ImportVACsvModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<VACsvRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<VACsvImportResult | null>(null)
  const [, startTransition] = useTransition()

  const reset = () => {
    setFileName(null)
    setRows([])
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      toast.error('Could not find a "name" column, or file is empty')
      return
    }
    setFileName(file.name)
    setRows(parsed)
    setResult(null)
  }

  const handleImport = async () => {
    setSubmitting(true)
    try {
      const res = await bulkImportVAs(rows)
      setResult(res)
      if (res.created > 0) {
        toast.success(`Imported ${res.created} VA${res.created === 1 ? '' : 's'}`)
        startTransition(() => router.refresh())
      }
      if (res.skipped.length > 0) {
        toast.warning(`${res.skipped.length} row${res.skipped.length === 1 ? '' : 's'} skipped`)
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Import failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleDownloadTemplate = () => {
    const csvContent = [
      [
        'name', 'email', 'hourlyRate', 'baseRate', 'vaaPosition', 'level', 'department',
        'availabilityStatus', 'status', 'engagementStatus', 'hybrid', 'preferredWorkHours', 'availableSchedule',
        'phone', 'personalEmail', 'workEmail', 'gender', 'birthDate', 'address',
        'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
        'facebookName', 'facebookUrl', 'linkedinUrl', 'notes',
      ].join(','),
      [
        'Juan Dela Cruz', 'juan@example.com', '5.50', '350', 'Virtual Assistant', 'L1', 'Operations',
        'AVAILABLE', 'ACTIVE', 'EMPLOYED', 'false', '40', 'Mon-Fri 9am-6pm',
        '09171234567', 'juan.personal@example.com', 'juan.work@example.com', 'Male', '1995-01-15', '123 Sample St.',
        'Maria Dela Cruz', '09179876543', 'Spouse',
        'Juan Dela Cruz', 'https://facebook.com/juandelacruz', 'https://linkedin.com/in/juandelacruz',
        'Sample VA row — replace or delete me',
      ].join(','),
    ].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'va-import-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => !o && handleClose()}
      title="Import VAs from CSV"
      description="Columns: name (required), email, hourlyRate, baseRate, vaaPosition, level, department, availabilityStatus, status, engagementStatus, hybrid, preferredWorkHours, availableSchedule, phone, personalEmail, workEmail, gender, birthDate, address, emergencyContactName/Phone/Relation, facebookName, facebookUrl, linkedinUrl, notes"
      size="md"
      footer={
        <>
          <Button type="button" variant="outline" size="sm" className="h-8" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button type="button" size="sm" className="h-8" disabled={rows.length === 0 || submitting} onClick={handleImport}>
              {submitting ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importing...</>
              ) : (
                <>Import {rows.length > 0 ? `${rows.length} VA${rows.length === 1 ? '' : 's'}` : ''}</>
              )}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-3">
        {!fileName && !result && (
          <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={handleDownloadTemplate}>
            <Download className="h-3.5 w-3.5 mr-1.5" />
            Download CSV Template
          </Button>
        )}

        {!fileName ? (
          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-8 cursor-pointer hover:bg-muted/40 transition-colors">
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
                <p className="text-[11px] text-muted-foreground">{rows.length} row{rows.length === 1 ? '' : 's'} detected</p>
              </div>
            </div>
            <button type="button" onClick={reset} className="p-1 hover:bg-accent rounded shrink-0">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {rows.length > 0 && !result && (
          <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-2 py-1.5 font-medium">Name</th>
                  <th className="text-left px-2 py-1.5 font-medium">Email</th>
                  <th className="text-left px-2 py-1.5 font-medium">Rate</th>
                  <th className="text-left px-2 py-1.5 font-medium">Department</th>
                  <th className="text-left px-2 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 truncate max-w-[140px]">{r.name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-[160px]">{r.email || 'auto-generated'}</td>
                    <td className="px-2 py-1 text-muted-foreground">{r.hourlyRate || '—'}</td>
                    <td className="px-2 py-1 text-muted-foreground truncate max-w-[120px]">{r.department || '—'}</td>
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

        {result && (
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium text-green-700">{result.created} created</span>
              {result.skipped.length > 0 && (
                <span className="text-muted-foreground"> · {result.skipped.length} skipped</span>
              )}
            </p>
            {result.skipped.length > 0 && (
              <div className="border rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                <ul className="text-[11px] divide-y">
                  {result.skipped.map((s, i) => (
                    <li key={i} className="px-2 py-1.5 text-muted-foreground">
                      Row {s.row}: {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  )
}
