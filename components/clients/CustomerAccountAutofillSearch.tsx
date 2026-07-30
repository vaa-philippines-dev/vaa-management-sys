'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Loader2, X, CheckCircle2 } from 'lucide-react'
import { searchCustomersForAutofill, type CustomerAutofillMatch, type AccountAutofillOption } from '@/app/(dashboard)/clients/actions'

const SELECT_CLASS = 'flex h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm'

const ACCOUNT_DETAIL_FIELDS: { label: string; key: keyof AccountAutofillOption }[] = [
  { label: 'Company', key: 'companyName' },
  { label: 'Category', key: 'category' },
  { label: 'Type', key: 'type' },
  { label: 'Country/Region', key: 'countryRegion' },
  { label: 'Status', key: 'status' },
  { label: 'Primary Contact', key: 'primaryContact' },
  { label: 'Secondary Contact', key: 'secondaryContact' },
  { label: 'Primary Email', key: 'primaryEmail' },
]

export function CustomerAccountAutofillSearch({
  onSelect,
}: {
  onSelect: (account: AccountAutofillOption, customer: CustomerAutofillMatch) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CustomerAutofillMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerAutofillMatch | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<AccountAutofillOption | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selectedCustomer) return
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
  }, [query, selectedCustomer])

  const pickAccount = (customer: CustomerAutofillMatch, account: AccountAutofillOption) => {
    setSelectedAccount(account)
    onSelect(account, customer)
  }

  const pickCustomer = (customer: CustomerAutofillMatch) => {
    setSelectedCustomer(customer)
    setQuery(customer.name)
    setOpen(false)
    setResults([])
    setSelectedAccount(null)
    if (customer.accounts.length === 1) {
      pickAccount(customer, customer.accounts[0])
    }
  }

  const reset = () => {
    setSelectedCustomer(null)
    setSelectedAccount(null)
    setQuery('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2.5">
      <div className="relative space-y-1.5">
        <label htmlFor="customer-autofill-search" className="flex items-center gap-1.5 text-xs font-medium">
          <Search className="h-3.5 w-3.5" />
          Customer Name
        </label>
        <div className="relative">
          <input
            id="customer-autofill-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => !selectedCustomer && results.length > 0 && setOpen(true)}
            placeholder="Search by customer name… (leave blank for a brand new customer)"
            className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm disabled:bg-muted disabled:text-muted-foreground"
            autoComplete="off"
            disabled={!!selectedCustomer}
          />
          {!selectedCustomer && loading && (
            <Loader2 className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {!selectedCustomer && !loading && query && (
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
          {selectedCustomer && (
            <button
              type="button"
              onClick={reset}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Change customer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {open && !selectedCustomer && results.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-lg">
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

        {open && !selectedCustomer && !loading && results.length === 0 && query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-lg border bg-popover px-3 py-2 text-xs text-muted-foreground shadow-lg">
            No existing customer matches &quot;{query}&quot; — looks like a brand new customer.
          </div>
        )}
      </div>

      {selectedCustomer && selectedCustomer.accounts.length === 0 && (
        <p className="text-xs text-muted-foreground">No accounts on file for {selectedCustomer.name} yet.</p>
      )}

      {selectedCustomer && selectedCustomer.accounts.length > 1 && (
        <div className="space-y-1.5">
          <label htmlFor="customer-autofill-account" className="text-xs font-medium">
            Account
          </label>
          <select
            id="customer-autofill-account"
            value={selectedAccount?.id ?? ''}
            onChange={(e) => {
              const account = selectedCustomer.accounts.find((a) => a.id === e.target.value)
              if (account) pickAccount(selectedCustomer, account)
            }}
            className={SELECT_CLASS}
          >
            <option value="">Select an account…</option>
            {selectedCustomer.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.accountName || a.companyName || 'Untitled account'}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedAccount && (
        <div className="rounded-md border bg-background p-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-success">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {selectedAccount.accountName || selectedAccount.companyName || 'Untitled account'} selected
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {ACCOUNT_DETAIL_FIELDS.filter((f) => selectedAccount[f.key]).map((f) => (
              <div key={f.key}>
                <span className="text-muted-foreground">{f.label}: </span>
                <span className="font-medium">{selectedAccount[f.key]}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
