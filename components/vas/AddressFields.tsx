'use client'

import { useState, useEffect, useRef } from 'react'

type Item = { code: string; name: string; type?: string }

type Props = {
  defaultValues?: {
    regionCode?: string
    provinceCode?: string
    cityCode?: string
    barangayCode?: string
  }
  namePrefix?: string
  onChange?: (level: string, code: string, name: string) => void
}

const fieldClass =
  'w-full px-2 py-1.5 text-xs border rounded-md bg-background h-8'

const labelClass = 'text-[10px] uppercase tracking-wider text-muted-foreground font-medium mb-0.5 block'

export function AddressFields({ defaultValues, namePrefix = 'address', onChange }: Props) {
  const [regionCode, setRegionCode] = useState(defaultValues?.regionCode ?? '')
  const [provinceCode, setProvinceCode] = useState(defaultValues?.provinceCode ?? '')
  const [cityCode, setCityCode] = useState(defaultValues?.cityCode ?? '')
  const [barangayCode, setBarangayCode] = useState(defaultValues?.barangayCode ?? '')

  const [regions, setRegions] = useState<Item[]>([])
  const [provinces, setProvinces] = useState<Item[]>([])
  const [cities, setCities] = useState<Item[]>([])
  const [barangays, setBarangays] = useState<Item[]>([])

  const [loading, setLoading] = useState({ regions: false, provinces: false, cities: false, barangays: false })
  const [error, setError] = useState<string | null>(null)
  const isNCR = regionCode === '130000000' || regionCode === 'NCR'

  useEffect(() => {
    let cancelled = false
    setLoading((l) => ({ ...l, regions: true }))
    setError(null)
    fetch('/api/address/regions')
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setRegions(d) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading((l) => ({ ...l, regions: false })) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!regionCode) {
      setProvinces([])
      setProvinceCode('')
      return
    }
    let cancelled = false
    setLoading((l) => ({ ...l, provinces: true }))
    fetch(`/api/address/provinces?parent=${regionCode}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setProvinces(d) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading((l) => ({ ...l, provinces: false })) })
    return () => { cancelled = true }
  }, [regionCode])

  useEffect(() => {
    if (!regionCode) {
      setCities([])
      setCityCode('')
      return
    }
    let cancelled = false
    setLoading((l) => ({ ...l, cities: true }))
    const parentParam = isNCR ? '130000000' : provinceCode
    if (!parentParam) {
      setCities([])
      setCityCode('')
      setLoading((l) => ({ ...l, cities: false }))
      return
    }
    fetch(`/api/address/cities?parent=${parentParam}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setCities(d) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading((l) => ({ ...l, cities: false })) })
    return () => { cancelled = true }
  }, [regionCode, provinceCode, isNCR])

  useEffect(() => {
    if (!cityCode) {
      setBarangays([])
      setBarangayCode('')
      return
    }
    let cancelled = false
    setLoading((l) => ({ ...l, barangays: true }))
    fetch(`/api/address/barangays?parent=${cityCode}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setBarangays(d) })
      .catch((e) => { if (!cancelled) setError(String(e)) })
      .finally(() => { if (!cancelled) setLoading((l) => ({ ...l, barangays: false })) })
    return () => { cancelled = true }
  }, [cityCode])

  const findName = (list: Item[], code: string) => list.find((x) => x.code === code)?.name ?? ''

  const handleRegionChange = (code: string) => {
    setRegionCode(code)
    setProvinceCode('')
    setCityCode('')
    setBarangayCode('')
    onChange?.('region', code, regions.find((r) => r.code === code)?.name ?? '')
  }
  const handleProvinceChange = (code: string) => {
    setProvinceCode(code)
    setCityCode('')
    setBarangayCode('')
    onChange?.('province', code, findName(provinces, code))
  }
  const handleCityChange = (code: string) => {
    setCityCode(code)
    setBarangayCode('')
    onChange?.('city', code, findName(cities, code))
  }
  const handleBarangayChange = (code: string) => {
    setBarangayCode(code)
    onChange?.('barangay', code, findName(barangays, code))
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name={`${namePrefix}.regionCode`} value={regionCode} />
      <input type="hidden" name={`${namePrefix}.region`} value={findName(regions, regionCode)} />
      <input type="hidden" name={`${namePrefix}.provinceCode`} value={isNCR ? 'NCR' : provinceCode} />
      <input type="hidden" name={`${namePrefix}.province`} value={isNCR ? 'Metro Manila' : findName(provinces, provinceCode)} />
      <input type="hidden" name={`${namePrefix}.cityCode`} value={cityCode} />
      <input type="hidden" name={`${namePrefix}.cityMunicipality`} value={findName(cities, cityCode)} />
      <input type="hidden" name={`${namePrefix}.barangayCode`} value={barangayCode} />
      <input type="hidden" name={`${namePrefix}.barangay`} value={findName(barangays, barangayCode)} />

      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Region</label>
          <select
            value={regionCode}
            onChange={(e) => handleRegionChange(e.target.value)}
            className={fieldClass}
            disabled={loading.regions}
          >
            <option value="">{loading.regions ? 'Loading…' : 'Select Region'}</option>
            {regions.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>{isNCR ? 'District' : 'Province'}</label>
          <select
            value={isNCR ? 'NCR' : provinceCode}
            onChange={(e) => {
              if (e.target.value === 'NCR') {
                handleRegionChange('130000000')
              } else {
                handleProvinceChange(e.target.value)
              }
            }}
            className={fieldClass}
            disabled={!regionCode || loading.provinces}
          >
            <option value="">
              {!regionCode ? 'Select region first' : loading.provinces ? 'Loading…' : isNCR ? 'No province' : 'Select Province'}
            </option>
            {!isNCR && provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>City / Municipality</label>
          <select
            value={cityCode}
            onChange={(e) => handleCityChange(e.target.value)}
            className={fieldClass}
            disabled={!regionCode || (!isNCR && !provinceCode) || loading.cities}
          >
            <option value="">
              {!regionCode
                ? 'Select region first'
                : !isNCR && !provinceCode
                ? 'Select province first'
                : loading.cities
                ? 'Loading…'
                : 'Select City/Municipality'}
            </option>
            {cities.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
                {c.type && c.type !== 'City' && c.type !== 'Mun' ? ` (${c.type})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Barangay</label>
          <select
            value={barangayCode}
            onChange={(e) => handleBarangayChange(e.target.value)}
            className={fieldClass}
            disabled={!cityCode || loading.barangays}
          >
            <option value="">
              {!cityCode ? 'Select city first' : loading.barangays ? 'Loading…' : 'Select Barangay'}
            </option>
            {barangays.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}
      <p className="text-[10px] text-muted-foreground">
        Address data powered by the Philippine Standard Geographic Code (PSGC) API
      </p>
    </div>
  )
}
