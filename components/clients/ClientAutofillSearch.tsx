'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2, X } from 'lucide-react'
import { searchClientsForAutofill, type ClientAutofillMatch } from '@/app/(dashboard)/clients/actions'

export function ClientAutofillSearch({ onSelect }: { onSelect: (match: ClientAutofillMatch) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ClientAutofillMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const trimmed = query.trim()
    if (trimmed.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale results when the query shrinks below the search threshold, not syncing from an external system
      setResults([])
      setOpen(false)
      return
    }
    debounceRef.current = setTimeout(() => {
      setLoading(true)
      searchClientsForAutofill(trimmed)
        .then((matches) => {
          setResults(matches)
          setOpen(true)
        })
        .finally(() => setLoading(false))
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query])

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
      <label htmlFor="client-autofill-search" className="flex items-center gap-1.5 text-xs font-medium">
        <Search className="h-3.5 w-3.5" />
        Returning client? Search to autofill their info
      </label>
      <div className="relative">
        <input
          id="client-autofill-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by name or email…"
          className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        {!loading && query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setResults([])
              setOpen(false)
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {results.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                onSelect(r)
                setOpen(false)
                setQuery(r.name)
              }}
              className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent transition-colors"
            >
              <span className="font-medium">{r.name}</span>
              <span className="text-muted-foreground">
                {[r.contactEmail, r.departmentName].filter(Boolean).join(' · ') || 'No extra details on file'}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          No existing client matches &quot;{query}&quot; — looks like a brand new client.
        </div>
      )}
    </div>
  )
}
