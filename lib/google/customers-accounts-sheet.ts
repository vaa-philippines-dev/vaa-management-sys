import { google } from 'googleapis'

const CUSTOMERS_TAB = 'Customers'
const ACCOUNTS_TAB = 'Clients' // the CMS's "Clients" tab — labeled "Accounts" in this app

function getAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')

  if (!email || !key) {
    return null
  }

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: email,
      private_key: key,
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  })
}

export type RawSheetRow = Record<string, string | number | boolean | null>

// Excel/Sheets serial date (epoch 1899-12-30, includes the historical 1900
// leap-year bug that both Excel and Sheets preserve for compatibility).
// 25569 = number of days between that epoch and 1970-01-01.
export function excelSerialToDate(value: unknown): Date | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n) || n <= 0) return null
  return new Date(Math.round((n - 25569) * 86400 * 1000))
}

// Reads a tab and zips each row against its header row, so callers key off
// column names instead of positional indices. Uses SERIAL_NUMBER (not
// FORMATTED_STRING, unlike the VAConnections fetch) so date cells come back
// as deterministic numbers regardless of the sheet's display formatting —
// converted via excelSerialToDate() by the caller wherever a column is
// known to be a date.
async function fetchTabRows(tabName: string): Promise<RawSheetRow[]> {
  const auth = getAuth()
  if (!auth) {
    throw new Error('Google credentials not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY)')
  }

  const sheetId = process.env.GOOGLE_VA_CONNECTIONS_SHEET_ID
  if (!sheetId) {
    throw new Error('GOOGLE_VA_CONNECTIONS_SHEET_ID not configured')
  }

  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: tabName,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'SERIAL_NUMBER',
  })

  const values = res.data.values
  if (!values || values.length < 2) return []

  const header = values[0].map((h) => String(h).trim())
  const rows = values.slice(1)

  return rows.map((row) => {
    const record: RawSheetRow = {}
    header.forEach((col, i) => {
      if (!col) return // blank header cells (the sheet has several) aren't addressable, so drop them
      // Both tabs repeat a handful of header names later in the row (e.g.
      // "Customer Name" appears twice on the Clients tab, likely a helper
      // column for in-sheet formulas) — keep the first occurrence so a
      // later duplicate can't silently overwrite the real value.
      if (col in record) return
      const cell = row[i]
      record[col] = cell === undefined ? null : cell
    })
    return record
  })
}

export function fetchCustomersRows(): Promise<RawSheetRow[]> {
  return fetchTabRows(CUSTOMERS_TAB)
}

export function fetchAccountsRows(): Promise<RawSheetRow[]> {
  return fetchTabRows(ACCOUNTS_TAB)
}
