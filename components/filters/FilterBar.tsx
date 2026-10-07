'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useRef } from 'react'
import { Search, X } from 'lucide-react'

type FilterOption = {
  value: string
  label: string
}

type FilterConfig = {
  key: string
  label: string
  options: FilterOption[]
  placeholder?: string
  defaultValue?: string
}

type FilterBarProps = {
  filters: FilterConfig[]
  searchPlaceholder?: string
  searchKey?: string
  // Set when several FilterBars share one page (the Masterlist's Staff and VA
  // tables): the URL params this bar owns, so its Clear button and "has
  // filters" check leave the other table's params alone.
  paramKeys?: string[]
}

export function FilterBar({
  filters,
  searchPlaceholder = 'Search...',
  searchKey = 'q',
  paramKeys,
}: FilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchRef = useRef<HTMLInputElement>(null)

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.replace(`?${params.toString()}`, { scroll: false })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [searchParams]
  )

  const clearAll = useCallback(() => {
    if (searchRef.current) searchRef.current.value = ''
    if (!paramKeys) {
      router.replace('', { scroll: false })
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    for (const k of paramKeys) params.delete(k)
    router.replace(`?${params.toString()}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, paramKeys])

  const hasFilters = paramKeys ? paramKeys.some((k) => searchParams.has(k)) : searchParams.toString().length > 0

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <div className="relative flex-1 min-w-[200px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={searchRef}
          defaultValue={searchParams.get(searchKey) ?? ''}
          placeholder={searchPlaceholder}
          className="w-full pl-8 pr-3 py-1.5 text-xs border rounded-md bg-background h-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              updateParam(searchKey, (e.target as HTMLInputElement).value)
            }
          }}
        />
        {searchParams.get(searchKey) && (
          <button
            type="button"
            onClick={() => {
              if (searchRef.current) searchRef.current.value = ''
              updateParam(searchKey, '')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {filters.map((f) => (
        <select
          key={f.key}
          value={searchParams.get(f.key) ?? f.defaultValue ?? ''}
          onChange={(e) => updateParam(f.key, e.target.value)}
          className="px-2.5 py-1.5 text-xs border rounded-md bg-background h-8 min-w-[100px]"
        >
          {!f.defaultValue && <option value="">{f.placeholder ?? `All ${f.label}`}</option>}
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      ))}

      {hasFilters && (
        <button
          type="button"
          onClick={clearAll}
          className="px-2.5 py-1.5 text-xs border rounded-md bg-background h-8 text-muted-foreground hover:text-foreground hover:border-destructive/30 transition-colors"
        >
          <X className="h-3 w-3 inline mr-1" />
          Clear
        </button>
      )}
    </div>
  )
}
