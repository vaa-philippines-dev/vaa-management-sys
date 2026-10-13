import { isEndedVAStatus } from '@/lib/active-va'

// Availability labels and roster buckets for a team's member list — shared by
// the server-rendered team page (stat tiles) and the client roster (filters).

export type Tone = 'success' | 'warning' | 'destructive' | 'info' | 'neutral'

export const AVAILABILITY_TONE: Record<string, Tone> = {
  AVAILABLE: 'success',
  PARTIALLY_ASSIGNED: 'info',
  FULLY_ASSIGNED: 'warning',
  ON_LEAVE: 'neutral',
  UNAVAILABLE: 'destructive',
  ON_HOLD_BY_VA: 'neutral',
  ON_HOLD_BY_VAA: 'neutral',
  RECOMMENDED: 'info',
}

export const AVAILABILITY_LABEL: Record<string, string> = {
  AVAILABLE: 'Available',
  PARTIALLY_ASSIGNED: 'Partially Assigned',
  FULLY_ASSIGNED: 'Fully Assigned',
  ON_LEAVE: 'On hold by VA',
  UNAVAILABLE: 'Unavailable',
  ON_HOLD_BY_VA: 'On hold by VA',
  ON_HOLD_BY_VAA: 'On hold by VAA',
  RECOMMENDED: 'Recommended',
}

// The roster's quick filters, in the order they're shown. "Ended" are VAs who
// left but whose team membership was never closed out — flagged for removal.
export type RosterBucket = 'AVAILABLE' | 'ASSIGNED' | 'ON_HOLD' | 'ENDED'

export const BUCKET_LABEL: Record<RosterBucket, string> = {
  AVAILABLE: 'Available',
  ASSIGNED: 'Assigned',
  ON_HOLD: 'On hold / Unavailable',
  ENDED: 'Left VAA',
}

// When the viewer can see a member's engagements (`clients` not null), those
// decide Assigned vs Available — the same derived rule as Team Assignment,
// since the hand-set availability field often lags behind. Without them it's
// the availability field alone.
export function rosterBucket(m: {
  availabilityStatus: string | null
  vaStatus: string | null
  clients?: unknown[] | null
}): RosterBucket | null {
  if (isEndedVAStatus(m.vaStatus)) return 'ENDED'
  const known = m.clients != null
  if (known && m.clients!.length > 0) return 'ASSIGNED'
  switch (m.availabilityStatus) {
    case 'UNAVAILABLE':
    case 'ON_LEAVE':
    case 'ON_HOLD_BY_VA':
    case 'ON_HOLD_BY_VAA':
      return 'ON_HOLD'
    case 'PARTIALLY_ASSIGNED':
    case 'FULLY_ASSIGNED':
      return known ? 'AVAILABLE' : 'ASSIGNED'
    case 'AVAILABLE':
    case 'RECOMMENDED':
      return 'AVAILABLE'
    default:
      return known ? 'AVAILABLE' : null
  }
}
