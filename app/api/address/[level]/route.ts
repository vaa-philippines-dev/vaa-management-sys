import { NextRequest, NextResponse } from 'next/server'

const PSGC_BASE = 'https://psgc.gitlab.io/api'

const CACHE_TTL = 60 * 60 * 24 * 7 // 1 week

const cache = new Map<string, { data: unknown; expires: number }>()

async function fetchCached<T>(url: string): Promise<T> {
  const cached = cache.get(url)
  if (cached && cached.expires > Date.now()) {
    return cached.data as T
  }
  const res = await fetch(url, { next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`PSGC fetch failed: ${res.status}`)
  const data = await res.json()
  cache.set(url, { data, expires: Date.now() + CACHE_TTL * 1000 })
  return data as T
}

type PSGCItem = {
  code: string
  name: string
  type?: string
  islandGroupCode?: string
  regionCode?: string
  provinceCode?: string
  cityCode?: string
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ level: string }> }) {
  const { level } = await params
  const { searchParams } = new URL(_req.url)
  const parent = searchParams.get('parent')

  try {
    let data: PSGCItem[]

    if (level === 'regions') {
      data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/regions`)
    } else if (level === 'provinces') {
      if (!parent) {
        data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/provinces`)
      } else {
        data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/regions/${parent}/provinces`)
      }
    } else if (level === 'cities') {
      if (parent) {
        const upper = parent.toUpperCase()
        if (upper === '130000000' || upper === 'NCR') {
          data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/regions/130000000/cities-municipalities`)
        } else {
          data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/provinces/${parent}/cities-municipalities`)
        }
      } else {
        data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/cities-municipalities`)
      }
    } else if (level === 'barangays') {
      if (!parent) {
        return NextResponse.json({ error: 'parent (city code) is required' }, { status: 400 })
      }
      data = await fetchCached<PSGCItem[]>(`${PSGC_BASE}/cities-municipalities/${parent}/barangays`)
    } else {
      return NextResponse.json({ error: 'Invalid level. Use: regions, provinces, cities, barangays' }, { status: 400 })
    }

    return NextResponse.json(
      data.map((item) => ({ code: item.code, name: item.name, type: item.type })),
      {
        headers: {
          'Cache-Control': `public, s-maxage=${CACHE_TTL}, stale-while-revalidate=86400`,
        },
      }
    )
  } catch (e: any) {
    return NextResponse.json(
      { error: e.message ?? 'Failed to fetch from PSGC' },
      { status: 500 }
    )
  }
}
