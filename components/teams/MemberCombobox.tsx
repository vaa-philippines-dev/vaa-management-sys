'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Search, UserPlus, X } from 'lucide-react'

export type ComboboxOption = { userId: string; name: string }

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

export function MemberCombobox({
  options,
  value,
  onSelect,
  disabled,
  placeholder = 'Search people to add…',
}: {
  options: ComboboxOption[]
  value: string
  onSelect: (userId: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.userId === value) ?? null

  const results = useMemo(() => {
    if (!query.trim()) return options
    const q = query.toLowerCase()
    return options.filter((o) => o.name.toLowerCase().includes(q))
  }, [query, options])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = (option: ComboboxOption) => {
    onSelect(option.userId)
    setQuery('')
    setOpen(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = results[activeIndex]
      if (opt) handleSelect(opt)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-input bg-background pl-1 pr-2 py-1 text-xs">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
          {initials(selected.name)}
        </span>
        <span className="font-medium">{selected.name}</span>
        <button
          type="button"
          onClick={() => onSelect('')}
          disabled={disabled}
          className="ml-1 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:pointer-events-none disabled:opacity-50"
          aria-label="Clear selection"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative w-full sm:w-64">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => {
            setOpen(true)
            setActiveIndex(0)
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          className="h-8 w-full rounded-md border border-input bg-background pl-7 pr-2 text-xs transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50"
        />
      </div>

      {open && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border bg-popover shadow-lg animate-in fade-in-0 zoom-in-95 duration-100">
          {results.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              {options.length === 0 ? 'No eligible members' : 'No matches found'}
            </p>
          ) : (
            <ul role="listbox">
              {results.map((option, i) => (
                <li key={option.userId} role="option" aria-selected={i === activeIndex}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => handleSelect(option)}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs transition-colors',
                      i === activeIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
                    )}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                      {initials(option.name)}
                    </span>
                    <span className="font-medium">{option.name}</span>
                    <UserPlus className="ml-auto h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
