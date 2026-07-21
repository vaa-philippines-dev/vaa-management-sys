import { google } from 'googleapis'

const TAB_NAME = 'VAConnections'

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

export type RawVAConnectionRow = Record<string, string>

// Reads the VAConnections tab and zips each row against the header row, so
// callers can key off column names instead of positional indices — the sheet's
// column order isn't something this app controls.
export async function fetchVAConnectionRows(): Promise<RawVAConnectionRow[]> {
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
    range: TAB_NAME,
    valueRenderOption: 'UNFORMATTED_VALUE',
    dateTimeRenderOption: 'FORMATTED_STRING',
  })

  const values = res.data.values
  if (!values || values.length < 2) return []

  const header = values[0].map((h) => String(h).trim())
  const rows = values.slice(1)

  return rows.map((row) => {
    const record: RawVAConnectionRow = {}
    header.forEach((col, i) => {
      record[col] = row[i] !== undefined && row[i] !== null ? String(row[i]).trim() : ''
    })
    return record
  })
}
