'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2, X, ChevronLeft } from 'lucide-react'
import { searchCustomersForAutofill, type CustomerAutofillMatch, type AccountAutofillOption } from '@/app/(dashboard)/clients/actions'

export function CustomerAccountAutofillSearch({
  onSelect,
}: {
  onSelect: (account: AccountAutofillOption, customer: CustomerAutofillMatch) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerAutofillMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  // When a customer with more than one account is picked, show their
  // accounts to choose from instead of immediately autofilling.
  const [pendingCustomer, setPendingCustomer] = useState<CustomerAutofillMatch | null>(null)
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
      searchCustomersForAutofill(trimmed)
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

  const pickCustomer = (customer: CustomerAutofillMatch) => {
    if (customer.accounts.length === 1) {
      onSelect(customer.accounts[0], customer)
      setOpen(false)
      setQuery(customer.name)
    } else if (customer.accounts.length > 1) {
      setPendingCustomer(customer)
    }
    // A customer with zero accounts has nothing to autofill from — leave
    // the search open so the user can pick a different match or give up.
  }

  const pickAccount = (account: AccountAutofillOption) => {
    if (!pendingCustomer) return
    onSelect(account, pendingCustomer)
    setOpen(false)
    setQuery(pendingCustomer.name)
    setPendingCustomer(null)
  }

  return (
    <div className="relative rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-1.5">
      <label htmlFor="customer-autofill-search" className="flex items-center gap-1.5 text-xs font-medium">
        <Search className="h-3.5 w-3.5" />
        Returning customer? Search to autofill their account info
      </label>
      <div className="relative">
        <input
          id="customer-autofill-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setPendingCustomer(null)
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search by customer name…"
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
              setPendingCustomer(null)
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {open && pendingCustomer && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          <button
            type="button"
            onClick={() => setPendingCustomer(null)}
            className="flex w-full items-center gap-1 border-b px-3 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
            {pendingCustomer.name} has {pendingCustomer.accounts.length} accounts — pick one
          </button>
          {pendingCustomer.accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => pickAccount(a)}
              className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent transition-colors"
            >
              <span className="font-medium">{a.accountName || a.companyName || 'Untitled account'}</span>
              <span className="text-muted-foreground">
                {[a.companyName !== a.accountName ? a.companyName : null, a.category, a.status].filter(Boolean).join(' · ') || 'No extra details on file'}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !pendingCustomer && results.length > 0 && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => pickCustomer(c)}
              className="flex w-full flex-col items-start gap-0.5 border-b px-3 py-2 text-left text-xs last:border-b-0 hover:bg-accent transition-colors"
            >
              <span className="font-medium">{c.name}</span>
              <span className="text-muted-foreground">
                {c.accounts.length} account{c.accounts.length === 1 ? '' : 's'}
                {c.accounts.length === 1 && c.accounts[0].companyName ? ` · ${c.accounts[0].companyName}` : ''}
              </span>
            </button>
          ))}
        </div>
      )}

      {open && !pendingCustomer && !loading && results.length === 0 && query.trim().length >= 2 && (
        <div className="absolute left-3 right-3 top-full z-30 mt-1 rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
          No existing customer matches &quot;{query}&quot; — looks like a brand new customer.
        </div>
      )}
    </div>
  )
}
