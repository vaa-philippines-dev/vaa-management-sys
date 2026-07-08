import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

type PaginationProps = {
  page: number
  pageCount: number
  buildHref: (page: number) => string
  className?: string
}

export function Pagination({ page, pageCount, buildHref, className }: PaginationProps) {
  if (pageCount <= 1) return null

  const pages = getPageList(page, pageCount)

  return (
    <div className={cn('flex items-center justify-center gap-1', className)}>
      <PageLink href={buildHref(page - 1)} disabled={page <= 1} aria-label="Previous page">
        <ChevronLeft className="h-3.5 w-3.5" />
      </PageLink>

      {pages.map((p, i) =>
        p === 'ellipsis' ? (
          <span key={`e-${i}`} className="px-1.5 text-xs text-muted-foreground">
            …
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(p)}
            className={cn(
              'flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs font-medium transition-colors',
              p === page
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {p}
          </Link>
        )
      )}

      <PageLink href={buildHref(page + 1)} disabled={page >= pageCount} aria-label="Next page">
        <ChevronRight className="h-3.5 w-3.5" />
      </PageLink>
    </div>
  )
}

function PageLink({
  href,
  disabled,
  children,
  ...props
}: { href: string; disabled: boolean; children: React.ReactNode } & React.ComponentProps<'a'>) {
  if (disabled) {
    return (
      <span className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/30">
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      {...props}
    >
      {children}
    </Link>
  )
}

function getPageList(page: number, pageCount: number): (number | 'ellipsis')[] {
  const delta = 1
  const range: (number | 'ellipsis')[] = []
  const rangeStart = Math.max(2, page - delta)
  const rangeEnd = Math.min(pageCount - 1, page + delta)

  range.push(1)
  if (rangeStart > 2) range.push('ellipsis')
  for (let i = rangeStart; i <= rangeEnd; i++) range.push(i)
  if (rangeEnd < pageCount - 1) range.push('ellipsis')
  if (pageCount > 1) range.push(pageCount)

  return range
}
