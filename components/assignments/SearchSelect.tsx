'use client'

import { useMemo, useState } from 'react'
import { Combobox } from '@base-ui/react/combobox'
import { Check, ChevronDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SearchSelectOption = {
  id: string
  label: string
  // Second line under the label (company, platform, skills…).
  description?: string
  // Short tag shown inside the closed field (and on the row, unless it just
  // repeats the group), so two same-named options — one client record per
  // department — stay distinct once picked.
  tag?: string
  group?: string
  // Extra text the search matches on without displaying it.
  keywords?: string
}

type OptionGroup = { label: string; items: SearchSelectOption[] }

// Searchable, grouped single-select for long pickers. Submits the selected
// option's id under `name`, like the native <select> it replaces.
export function SearchSelect({
  id,
  name,
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  emptyText = 'No matches found',
  required,
}: {
  id?: string
  name: string
  options: SearchSelectOption[]
  value: string
  onValueChange: (id: string) => void
  placeholder?: string
  emptyText?: string
  required?: boolean
}) {
  const [query, setQuery] = useState('')
  const selected = options.find((o) => o.id === value) ?? null

  // Filtering is done here rather than by Combobox so empty groups disappear
  // and the search also covers description/group/keywords. When the input
  // just echoes the selected label, show everything again.
  const groups = useMemo<OptionGroup[]>(() => {
    const q = query.trim().toLowerCase()
    const showAll = !q || (selected && q === selected.label.toLowerCase())
    const byGroup = new Map<string, SearchSelectOption[]>()
    for (const o of options) {
      if (!showAll) {
        const haystack = [o.label, o.description, o.tag, o.group, o.keywords].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) continue
      }
      const key = o.group ?? ''
      const list = byGroup.get(key)
      if (list) list.push(o)
      else byGroup.set(key, [o])
    }
    return [...byGroup].map(([label, items]) => ({ label, items }))
  }, [options, query, selected])

  return (
    <Combobox.Root
      id={id}
      name={name}
      required={required}
      items={groups}
      filter={null}
      value={selected}
      onValueChange={(o: SearchSelectOption | null) => onValueChange(o?.id ?? '')}
      inputValue={query}
      onInputValueChange={setQuery}
      itemToStringLabel={(o: SearchSelectOption) => o.label}
      itemToStringValue={(o: SearchSelectOption) => o.id}
      isItemEqualToValue={(a: SearchSelectOption, b: SearchSelectOption) => a.id === b.id}
      autoHighlight
    >
      <Combobox.InputGroup className="relative flex h-10 w-full items-center rounded-lg border border-input bg-background text-foreground shadow-xs transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/40 dark:bg-input/30">
        <Search className="pointer-events-none ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
        <Combobox.Input
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-sm font-medium text-foreground outline-none placeholder:font-normal placeholder:text-muted-foreground"
        />
        {selected?.tag && (
          <span className="mr-1 max-w-[40%] shrink-0 truncate rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
            {selected.tag}
          </span>
        )}
        {selected && (
          <Combobox.Clear
            aria-label="Clear selection"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </Combobox.Clear>
        )}
        <Combobox.Trigger
          aria-label="Show options"
          className="mr-1.5 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={6} className="z-50 outline-none">
          <Combobox.Popup className="w-[var(--anchor-width)] min-w-64 max-h-[min(var(--available-height),22rem)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-popover text-popover-foreground shadow-xl outline-none transition-[opacity,transform] duration-100 data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
            <Combobox.Empty className="px-4 py-6 text-center text-sm text-muted-foreground empty:hidden">
              {emptyText}
            </Combobox.Empty>
            <Combobox.List className="py-1 empty:p-0">
              {(group: OptionGroup) => (
                <Combobox.Group key={group.label} items={group.items} className="pb-1">
                  {group.label && (
                    <Combobox.GroupLabel className="sticky top-0 z-10 flex items-center justify-between border-b border-border/60 bg-popover/95 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                      <span>{group.label}</span>
                      <span className="font-medium normal-case tracking-normal">{group.items.length}</span>
                    </Combobox.GroupLabel>
                  )}
                  <Combobox.Collection>
                    {(o: SearchSelectOption) => (
                      <Combobox.Item
                        key={o.id}
                        value={o}
                        className={cn(
                          'mx-1 flex cursor-pointer select-none items-center gap-3 rounded-lg px-2.5 py-2 text-sm text-foreground outline-none',
                          'data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{o.label}</div>
                          {o.description && (
                            <div className="truncate text-xs text-muted-foreground">{o.description}</div>
                          )}
                        </div>
                        {o.tag && o.tag !== o.group && (
                          <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {o.tag}
                          </span>
                        )}
                        <Combobox.ItemIndicator className="shrink-0 text-primary">
                          <Check className="h-4 w-4" />
                        </Combobox.ItemIndicator>
                      </Combobox.Item>
                    )}
                  </Combobox.Collection>
                </Combobox.Group>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
