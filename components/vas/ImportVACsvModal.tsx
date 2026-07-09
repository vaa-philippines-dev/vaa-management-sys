'use client'

import { useRef, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { UploadCloud, FileText, X, Download, Minus } from 'lucide-react'
import { toast } from 'sonner'
import type { VACsvRow } from '@/app/(dashboard)/vas/actions'
import { useVACsvImport } from '@/components/vas/VACsvImportContext'

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

  const firstNameIdx = idx('firstname', 'first name')
  const middleNameIdx = idx('middlename', 'middle name')
  const lastNameIdx = idx('lastname', 'last name')
  const extNameIdx = idx('extname', 'ext. name', 'ext name', 'suffix')
  const emailIdx = idx('email')
  const rateIdx = idx('hourlyrate', 'hourly rate', 'rate')
  const baseRateIdx = idx('baserate', 'base rate')
  const positionIdx = idx('vaaposition', 'position', 'vaa position')
  const levelIdx = idx('level')
  const departmentIdx = idx('department')
  const availabilityIdx = idx('availabilitystatus', 'availability status', 'availability')
  const recommendabilityIdx = idx('recommendability')
  const statusIdx = idx('status', 'active status')
  const onHoldIdx = idx('onhold', 'on hold', 'hold status', 'hold')
  const engagementIdx = idx('engagementstatus', 'engagement status')
  const hybridIdx = idx('hybrid')
  const preferredHoursIdx = idx('preferredworkhours', 'preferred work hours', 'preferred hours')
  const scheduleIdx = idx('availableschedule', 'available schedule', 'schedule')
  const phoneIdx = idx('phone')
  const personalEmailIdx = idx('personalemail', 'personal email')
  const workEmailIdx = idx('workemail', 'work email')
  const genderIdx = idx('gender')
  const birthDateIdx = idx('birthdate', 'birth date')
  const birthdayCelebrantIdx = idx('birthdaycelebrant', 'birthday celebrant')
  const addressLineIdx = idx('addressline', 'address line')
  const barangayIdx = idx('barangay')
  const cityMunicipalityIdx = idx('citymunicipality', 'city/municipality', 'city municipality', 'city')
  const provinceIdx = idx('province')
  const zipCodeIdx = idx('zipcode', 'zip code', 'zip')
  const landmarkIdx = idx('landmark')
  const gcashNumberIdx = idx('gcashnumber', 'gcash number', 'gcash')
  const emergencyNameIdx = idx('emergencycontactname', 'emergency contact name')
  const emergencyPhoneIdx = idx('emergencycontactphone', 'emergency contact phone')
  const emergencyRelationIdx = idx('emergencycontactrelation', 'emergency contact relation')
  const facebookNameIdx = idx('facebookname', 'facebook name')
  const facebookUrlIdx = idx('facebookurl', 'facebook url')
  const linkedinIdx = idx('linkedinurl', 'linkedin url', 'linkedin')
  const notesIdx = idx('notes')

  if (firstNameIdx === -1) return []

  const cell = (cells: string[], i: number) => (i !== -1 ? cells[i] : undefined)

  return lines.slice(1).map((line) => {
    const cells = parseLine(line)
    return {
      firstName: cells[firstNameIdx] || '',
      middleName: cell(cells, middleNameIdx),
      lastName: cell(cells, lastNameIdx),
      extName: cell(cells, extNameIdx),
      email: cell(cells, emailIdx),
      hourlyRate: cell(cells, rateIdx),
      baseRate: cell(cells, baseRateIdx),
      vaaPosition: cell(cells, positionIdx),
      level: cell(cells, levelIdx),
      department: cell(cells, departmentIdx),
      availabilityStatus: cell(cells, availabilityIdx),
      recommendability: cell(cells, recommendabilityIdx),
      status: cell(cells, statusIdx),
      onHold: cell(cells, onHoldIdx),
      engagementStatus: cell(cells, engagementIdx),
      hybrid: cell(cells, hybridIdx),
      preferredWorkHours: cell(cells, preferredHoursIdx),
      availableSchedule: cell(cells, scheduleIdx),
      phone: cell(cells, phoneIdx),
      personalEmail: cell(cells, personalEmailIdx),
      workEmail: cell(cells, workEmailIdx),
      gender: cell(cells, genderIdx),
      birthDate: cell(cells, birthDateIdx),
      birthdayCelebrant: cell(cells, birthdayCelebrantIdx),
      addressLine: cell(cells, addressLineIdx),
      barangay: cell(cells, barangayIdx),
      cityMunicipality: cell(cells, cityMunicipalityIdx),
      province: cell(cells, provinceIdx),
      zipCode: cell(cells, zipCodeIdx),
      landmark: cell(cells, landmarkIdx),
      gcashNumber: cell(cells, gcashNumberIdx),
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

export function ImportVACsvModal() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [rows, setRows] = useState<VACsvRow[]>([])
  const [overwriteExisting, setOverwriteExisting] = useState(false)
  const { state: importState, startImport, minimize, cancelImport, closeModal, reset: resetImport } = useVACsvImport()
  const open = importState.modalOpen

  const isRunning = importState.status === 'running'
  const isDone = importState.status === 'done' || importState.status === 'cancelled'

  const reset = () => {
    setFileName(null)
    setRows([])
    setOverwriteExisting(false)
    resetImport()
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleFile = async (file: File) => {
    const text = await file.text()
    const parsed = parseCsv(text)
    if (parsed.length === 0) {
      toast.error('Could not find a "firstName" column, or file is empty')
      return
    }
    setFileName(file.name)
    setRows(parsed)
  }

  const handleImport = () => {
    startImport(fileName ?? 'import.csv', rows, overwriteExisting)
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
    const csvContent = [
      [
        'firstName', 'middleName', 'lastName', 'extName', 'email', 'hourlyRate', 'baseRate', 'vaaPosition', 'level', 'department',
        'availabilityStatus', 'recommendability', 'status', 'onHold', 'engagementStatus', 'hybrid', 'preferredWorkHours', 'availableSchedule',
        'phone', 'personalEmail', 'workEmail', 'gender', 'birthDate', 'birthdayCelebrant',
        'addressLine', 'barangay', 'cityMunicipality', 'province', 'zipCode', 'landmark', 'gcashNumber',
        'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
        'facebookName', 'facebookUrl', 'linkedinUrl', 'notes',
      ].join(','),
      [
        'Juan', 'Santos', 'Dela Cruz', 'Jr.', 'juan@example.com', '5.50', '350', 'Virtual Assistant', 'L1', 'Amazon',
        'AVAILABLE', 'Highly Recommended', 'ACTIVE', 'false', 'EMPLOYED', 'false', '40', 'Mon-Fri 9am-6pm',
        '09171234567', 'juan.personal@example.com', 'juan.work@example.com', 'Male', '1995-01-15', 'true',
        '123 Sample St.', 'Barangay Sample', 'Quezon City', 'Metro Manila', '1100', 'Near sample landmark', '09171234567',
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
      description="Columns: firstName (required), middleName, lastName, extName, email, hourlyRate, baseRate, vaaPosition, level, department, availabilityStatus, recommendability, status (ACTIVE/PENDING/TRANSFERRED/RESIGNED/REMOVED/PROJECT_ENDED/CANCELLED), onHold, engagementStatus, hybrid, preferredWorkHours, availableSchedule, phone, personalEmail, workEmail, gender, birthDate, birthdayCelebrant, addressLine, barangay, cityMunicipality, province, zipCode, landmark, gcashNumber, emergencyContactName/Phone/Relation, facebookName, facebookUrl, linkedinUrl, notes"
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
                <Button type="button" size="sm" className="h-8" disabled={rows.length === 0} onClick={handleImport}>
                  Import {rows.length > 0 ? `${rows.length} VA${rows.length === 1 ? '' : 's'}` : ''}
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
              {importState.fileName} · {importState.processedRows}/{importState.totalRows} rows
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
            {!fileName && (
              <Button type="button" variant="outline" size="sm" className="h-8 w-full" onClick={handleDownloadTemplate}>
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Download CSV Template
              </Button>
            )}

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
                    <p className="text-[11px] text-muted-foreground">{rows.length} row{rows.length === 1 ? '' : 's'} detected</p>
                  </div>
                </div>
                <button type="button" onClick={reset} className="p-1 hover:bg-accent rounded shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {rows.length > 0 && (
              <label className="flex items-start gap-2 text-xs rounded-lg border p-3 bg-muted/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">Update existing VAs if matched</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    Matches by email, or by first + last name if no email. Blank cells won&apos;t erase existing data. Unmatched rows are still created as new.
                  </span>
                </span>
              </label>
            )}

            {rows.length > 0 && (
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
                        <td className="px-2 py-1 truncate max-w-[140px]">
                          {[r.firstName, r.middleName, r.lastName, r.extName].filter(Boolean).join(' ') || <span className="text-muted-foreground">—</span>}
                        </td>
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
          </>
        )}
      </div>
    </Modal>
  )
}
