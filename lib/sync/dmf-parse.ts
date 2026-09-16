// Parsing helpers for the DMF sheet import. The sheet uses at least three
// different date formats across its tabs (confirmed by inspecting live
// data, not guessed):
//   - "20 Aug 17"        (YY Mon DD)   — VA Preparation's TARGET/ACTUAL START DATE
//   - "Jul 07 2026"       (Mon DD YYYY) — VA Preparation's EFFECTIVITY DATE
//   - "Jan 8 2025" / "February 2026"    — Projects/Proposals' DATE column
//   - "Aug 20"           (Mon DD, no year) — Performance Monitoring's KPI due
//     dates, which are the sheet's own computed columns and are deliberately
//     NOT imported (lib/kpi-checks.ts computes the same dates from
//     Assignment.startDate) — see importPerformanceMonitoring().
const MONTH_INDEX: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

// Every branch below builds the date via Date.UTC rather than the native
// `new Date(string)` constructor. Confirmed the hard way: `new Date("February
// 2026")` parses as Feb 1 *local* midnight, which on a machine east of UTC
// (this one runs in Asia/Singapore, UTC+8) serializes to "2026-01-31" — an
// off-by-one that would vary by the server's timezone. Every DMF date is a
// bare calendar date with no time component, so it must be anchored to UTC
// explicitly, not left to whatever timezone happens to run the import.
export function parseDmfDate(raw: string | undefined | null): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '#N/A' || trimmed === '-') return null

  // "YY Mon DD" e.g. "20 Aug 17", "26 Jul 07" — VA Preparation's
  // TARGET/ACTUAL START DATE and VA Availability's DMF DATE CHANGED etc.
  const yyMonDd = trimmed.match(/^(\d{2})\s+([A-Za-z]{3,})\s+(\d{1,2})$/)
  if (yyMonDd) {
    const [, yy, monStr, dd] = yyMonDd
    const month = MONTH_INDEX[monStr.slice(0, 3).toLowerCase()]
    if (month === undefined) return null
    const d = new Date(Date.UTC(2000 + Number(yy), month, Number(dd)))
    return Number.isNaN(d.getTime()) ? null : d
  }

  // "Mon/Month DD[,] YYYY" e.g. "Jul 07 2026", "June 10 2025", "Jan 8, 2025"
  // — VA Preparation's EFFECTIVITY DATE and Projects' START DATE/DATE COMPLETED.
  const monDdYyyy = trimmed.match(/^([A-Za-z]{3,})\s+(\d{1,2}),?\s+(\d{4})$/)
  if (monDdYyyy) {
    const [, monStr, dd, yyyy] = monDdYyyy
    const month = MONTH_INDEX[monStr.slice(0, 3).toLowerCase()]
    if (month === undefined) return null
    const d = new Date(Date.UTC(Number(yyyy), month, Number(dd)))
    return Number.isNaN(d.getTime()) ? null : d
  }

  // "Month YYYY", day omitted — Projects' DATE column for a few rows
  // ("February 2026"). Defaults to the 1st.
  const monYyyy = trimmed.match(/^([A-Za-z]{3,})\s+(\d{4})$/)
  if (monYyyy) {
    const [, monStr, yyyy] = monYyyy
    const month = MONTH_INDEX[monStr.slice(0, 3).toLowerCase()]
    if (month === undefined) return null
    const d = new Date(Date.UTC(Number(yyyy), month, 1))
    return Number.isNaN(d.getTime()) ? null : d
  }

  // Unrecognized format — never fall back to locale-dependent native
  // parsing; report it as unparseable instead of silently guessing wrong.
  return null
}

export function parseDmfBool(raw: string | undefined | null): boolean {
  return (raw ?? '').trim().toUpperCase() === 'TRUE'
}

export function parseDmfNumber(raw: string | undefined | null): number | null {
  if (!raw) return null
  const cleaned = raw.replace(/,/g, '').trim()
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

// A row identifier for reports — falls back through whatever the tab
// actually has, since not every tab has a RECORD NO.
export function rowLabel(row: Record<string, string>): string {
  return row['RECORD NO'] || row['VA NAME'] || row['PROJECT NAME'] || '(unlabeled row)'
}
