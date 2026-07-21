import { NextRequest, NextResponse } from 'next/server'
import { loadVAConnectionRecords } from '@/lib/sync/va-connection-records'

// Phase 1: load-only. Mirrors the VAConnections sheet into va_connection_records
// so it's visible in the app. Turning rows into real Assignments (resolving
// VA/Client and writing via lib/sync/va-connections.ts's syncVAConnections())
// is a deliberately separate phase, not wired in here yet.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const summary = await loadVAConnectionRecords()

  return NextResponse.json(summary)
}
