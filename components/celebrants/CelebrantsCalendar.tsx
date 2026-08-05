'use client'

import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Cake, Wine, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/components/ui/modal'
import { Badge } from '@/components/ui/badge'

export type CelebrantEvent = {
  id: string
  name: string
  type: 'birthday' | 'anniversary'
  month: number
  day: number
  label?: string
  history?: string[]
}

type FilterValue = 'all' | 'birthday' | 'anniversary'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const TYPE_META: Record<CelebrantEvent['type'], { avatar: string; dot: string; badge: string }> = {
  birthday: {
    avatar: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
    dot: 'bg-amber-500',
    badge: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  },
  anniversary: {
    avatar: 'bg-violet-500/15 text-violet-700 dark:text-violet-400',
    dot: 'bg-violet-500',
    badge: 'bg-violet-500/10 text-violet-700 border-violet-500/20 dark:text-violet-400',
  },
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

const MAX_VISIBLE_PER_DAY = 2

export function CelebrantsCalendar({ events }: { events: CelebrantEvent[] }) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [filter, setFilter] = useState<FilterValue>('all')
  const [openDay, setOpenDay] = useState<number | null>(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()

  const filtered = useMemo(
    () => events.filter((e) => filter === 'all' || e.type === filter),
    [events, filter]
  )

  const eventsByDay = useMemo(() => {
    const map = new Map<number, CelebrantEvent[]>()
    for (const e of filtered) {
      if (e.month !== month) continue
      const list = map.get(e.day) ?? []
      list.push(e)
      map.set(e.day, list)
    }
    return map
  }, [filtered, month])

  const cells = useMemo(() => {
    const firstWeekday = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const list: (number | null)[] = []
    for (let i = 0; i < firstWeekday; i++) list.push(null)
    for (let d = 1; d <= daysInMonth; d++) list.push(d)
    while (list.length % 7 !== 0) list.push(null)
    return list
  }, [year, month])

  const isToday = (d: number) => d === today.getDate() && month === today.getMonth() && year === today.getFullYear()

  const goPrev = () => setCursor(new Date(year, month - 1, 1))
  const goNext = () => setCursor(new Date(year, month + 1, 1))
  const goToday = () => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))

  const openDayEvents = openDay !== null ? eventsByDay.get(openDay) ?? [] : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[132px] text-center text-sm font-semibold tracking-tight">
            {MONTH_NAMES[month]} {year}
          </span>
          <button
            type="button"
            onClick={goNext}
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="ml-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Today
          </button>
        </div>

        <div className="inline-flex rounded-md border p-0.5 text-xs">
          {([
            { value: 'all', label: 'All', icon: CalendarDays },
            { value: 'birthday', label: 'Birthdays', icon: Cake },
            { value: 'anniversary', label: 'Anniversaries', icon: Wine },
          ] as const).map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-2.5 py-1 transition-colors',
                filter === f.value ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <f.icon className="h-3 w-3" />
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day, i) => {
            const dayEvents = day ? eventsByDay.get(day) ?? [] : []
            const visible = dayEvents.slice(0, MAX_VISIBLE_PER_DAY)
            const overflow = dayEvents.length - visible.length
            const hasEvents = dayEvents.length > 0

            const content = (
              <>
                <span
                  className={cn(
                    'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                    day && isToday(day) ? 'bg-primary font-semibold text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  {day ?? ''}
                </span>
                {hasEvents && (
                  <div className="mt-1 space-y-0.5">
                    {visible.map((e) => (
                      <div key={e.id} className="flex items-center gap-1 text-[10px]">
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full text-[7px] font-semibold',
                            TYPE_META[e.type].avatar
                          )}
                        >
                          {initials(e.name)}
                        </span>
                        <span className="truncate">{e.name.split(' ')[0]}</span>
                      </div>
                    ))}
                    {overflow > 0 && (
                      <span className="block text-[10px] font-medium text-primary">+{overflow} more</span>
                    )}
                  </div>
                )}
              </>
            )

            if (!day) {
              return <div key={i} className="min-h-[76px] border-b border-r bg-muted/20 p-1.5 last:border-r-0" />
            }

            return hasEvents ? (
              <button
                key={i}
                type="button"
                onClick={() => setOpenDay(day)}
                className="min-h-[76px] border-b border-r p-1.5 text-left transition-colors last:border-r-0 hover:bg-accent/40"
              >
                {content}
              </button>
            ) : (
              <div key={i} className="min-h-[76px] border-b border-r p-1.5 last:border-r-0">
                {content}
              </div>
            )
          })}
        </div>
      </div>

      <Modal
        open={openDay !== null}
        onOpenChange={(open) => !open && setOpenDay(null)}
        title={openDay !== null ? `${MONTH_NAMES[month]} ${openDay}` : ''}
        size="sm"
      >
        <div className="space-y-3">
          {openDayEvents.map((e) => (
            <div key={e.id} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    TYPE_META[e.type].avatar
                  )}
                >
                  {initials(e.name)}
                </span>
                <div>
                  <p className="text-sm font-medium">{e.name}</p>
                  {e.history && e.history.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {e.history.map((h, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground">previously: {h}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Badge variant="outline" className={cn('shrink-0 text-[10px]', TYPE_META[e.type].badge)}>
                {e.type === 'birthday' ? 'Birthday' : e.label}
              </Badge>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
