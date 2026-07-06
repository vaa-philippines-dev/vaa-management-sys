import { cn } from "@/lib/utils"

type ProgressProps = {
  value?: number
  indeterminate?: boolean
  className?: string
}

function Progress({ value = 0, indeterminate = false, className }: ProgressProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={indeterminate ? undefined : value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn(
          'h-full rounded-full bg-primary transition-[width] duration-300 ease-out',
          indeterminate && 'w-1/3 animate-pulse'
        )}
        style={!indeterminate ? { width: `${Math.min(100, Math.max(0, value))}%` } : undefined}
      />
    </div>
  )
}

export { Progress }
