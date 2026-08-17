// Working-day arithmetic for the Resignation SOP's notice-period (30 working
// days) and payout SLA (7 working days) calculations. Excludes weekends
// only — there is no company holiday calendar in this system yet, so
// holiday accuracy is a known limitation (flagged in the source design doc
// as its own technical risk).

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay()
  return day === 0 || day === 6
}

// `date` advanced by `days` working days (negative to go backward, weekends
// skipped), preserving UTC midnight.
export function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const step = days >= 0 ? 1 : -1
  let remaining = Math.abs(days)
  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + step)
    if (!isWeekend(result)) remaining -= 1
  }
  return result
}

// Whole working days between `from` and `to` (weekends excluded); negative
// if `to` is before `from`.
export function workingDaysBetween(from: Date, to: Date): number {
  const sign = to.getTime() >= from.getTime() ? 1 : -1
  const start = sign === 1 ? from : to
  const end = sign === 1 ? to : from
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()))
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()))
  let count = 0
  while (cursor.getTime() < last.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (!isWeekend(cursor)) count += 1
  }
  return sign * count
}
