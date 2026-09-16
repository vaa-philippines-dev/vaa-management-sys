import { google } from 'googleapis'

// Generic reader for a Department Monitoring File spreadsheet. One DMF
// covers exactly one department (confirmed against the live "Amazon" sheet
// — every row in its VA Availability tab reads Dept: Amazon), so callers
// pass both the sheet id and the department it belongs to.
//
// Currently only one DMF is wired (GOOGLE_DEPT_MONITORING_SHEET_ID, Amazon).
// Other departments have their own sheets that aren't onboarded yet — add
// them here as they're shared with the service account, keyed by the
// department name as it appears in this app's `departments` table.
export const DMF_SHEETS: Record<string, string | undefined> = {
  Amazon: process.env.GOOGLE_DEPT_MONITORING_SHEET_ID,
}

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  if (!email || !key) return null

  return new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type RawDmfRow = Record<string, string>

// Reads one tab and zips each row against its own header row, same
// convention as fetchVAConnectionRows() — callers key off column names, not
// positional indices, since the sheet's column order isn't something this
// app controls. `headerRow` defaults to 1 but a couple of DMF tabs (e.g.
// "VA Preparation") have a merged title row above the real header.
//
// `fallbackColumnNames` supplies a synthetic header for a 0-indexed column
// whose own header cell is blank — "Projects/Proposals" has exactly one of
// these (its leading DATE column has no header text at all in the sheet).
export async function fetchDmfTabRows(
  sheetId: string,
  tabName: string,
  headerRow = 1,
  fallbackColumnNames: Record<number, string> = {}
): Promise<RawDmfRow[]> {
  const auth = getAuth()
  if (!auth) {
    throw new Error('Google credentials not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)')
  }

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,
    valueRenderOption: 'FORMATTED_VALUE',
  })

  const values = res.data.values || []
  const header = values[headerRow - 1] || []
  const dataRows = values.slice(headerRow)

  return dataRows
    .map((row) => {
      const record: RawDmfRow = {}
      header.forEach((col, i) => {
        const key = (col ?? '').toString().trim() || fallbackColumnNames[i]
        if (!key) return // several blank header cells exist in these tabs
        record[key] = (row[i] ?? '').toString().trim()
      })
      return record
    })
    .filter((record) => Object.values(record).some((v) => v !== ''))
}
