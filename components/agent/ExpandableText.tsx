'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

export function ExpandableText({
  text,
  limit = 150,
  className,
}: {
  text: string
  limit?: number
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const needsTruncation = text.length > limit

  if (!needsTruncation) {
    return <p className={className}>{text}</p>
  }

  return (
    <p className={className}>
      {expanded ? text : text.slice(0, limit).trimEnd() + '…'}{' '}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setExpanded((v) => !v)
        }}
        className={cn('font-medium text-primary hover:underline', className?.includes('text-') ? '' : 'text-[11px]')}
      >
        {expanded ? 'View less' : 'View more'}
      </button>
    </p>
  )
}
