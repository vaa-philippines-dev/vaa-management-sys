'use client'

import { useEffect, useState } from 'react'
import { Search, X } from 'lucide-react'
import { searchChannelMessages } from '@/app/(dashboard)/inbox/actions'

type SearchResult = {
  id: string
  body: string
  createdAt: string | Date
  sender: { firstName: string; lastName: string; avatarUrl?: string | null }
}

function highlightMatch(body: string, query: string) {
  if (!query.trim()) return body
  const index = body.toLowerCase().indexOf(query.toLowerCase())
  if (index === -1) return body
  const start = Math.max(0, index - 30)
  const end = Math.min(body.length, index + query.length + 60)
  const before = (start > 0 ? '…' : '') + body.slice(start, index)
  const match = body.slice(index, index + query.length)
  const after = body.slice(index + query.length, end) + (end < body.length ? '…' : '')
  return (
    <>
      {before}
      <mark className="rounded bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">{match}</mark>
      {after}
    </>
  )
}

export function SearchMessagesPanel({
  channelId,
  onClose,
  onJumpTo,
}: {
  channelId: string
  onClose: () => void
  onJumpTo: (messageId: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<{ forQuery: string; data: SearchResult[] } | null>(null)

  useEffect(() => {
    const trimmed = query.trim()
    if (!trimmed) return

    const timeout = setTimeout(() => {
      searchChannelMessages(channelId, trimmed).then((data) => {
        setResults({ forQuery: trimmed, data: data as unknown as SearchResult[] })
      })
    }, 250)
    return () => clearTimeout(timeout)
  }, [channelId, query])

  const trimmedQuery = query.trim()
  const loading = trimmedQuery !== '' && results?.forQuery !== trimmedQuery
  const currentResults = results?.forQuery === trimmedQuery ? results.data : null

  return (
    <div className="flex h-full w-72 shrink-0 flex-col border-l bg-card animate-in slide-in-from-right-8 fade-in-0 duration-200">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">Search messages</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="border-b p-2.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search in this conversation..."
            className="w-full rounded-md border border-input bg-transparent py-1.5 pl-8 pr-2.5 text-[12.5px] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {!trimmedQuery ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Type to search messages in this conversation.</p>
        ) : loading ? (
          <p className="py-8 text-center text-xs text-muted-foreground">Searching...</p>
        ) : currentResults && currentResults.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted-foreground">No messages found.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {currentResults?.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onJumpTo(m.id)}
                className="block w-full rounded-lg border bg-muted/30 p-2.5 text-left transition-colors hover:bg-muted/60"
              >
                <div className="flex items-center gap-1.5">
                  <div className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-[8px] font-semibold">
                    {m.sender.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={m.sender.avatarUrl}
                        alt={`${m.sender.firstName} ${m.sender.lastName}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <>
                        {m.sender.firstName?.[0]}
                        {m.sender.lastName?.[0]}
                      </>
                    )}
                  </div>
                  <p className="text-[11px] font-semibold">
                    {m.sender.firstName} {m.sender.lastName}
                  </p>
                </div>
                <p className="mt-1 line-clamp-3 text-[12px] text-muted-foreground">{highlightMatch(m.body, query)}</p>
                <p className="mt-1 text-[10px] text-muted-foreground/70">
                  {new Date(m.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
