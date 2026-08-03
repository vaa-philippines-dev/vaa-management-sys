import { cn } from '@/lib/utils'

/**
 * Marks a name as belonging to a system/automation account (e.g. Vee's
 * Inbox notifications) rather than a real staff member. Render next to any
 * `firstName`/`lastName` display wherever `isBot` is true.
 */
export function BotBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground',
        className
      )}
    >
      Bot
    </span>
  )
}
