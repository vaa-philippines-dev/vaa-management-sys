import { cn } from "@/lib/utils"

const DOT_COLOR: Record<string, string> = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
  info: "bg-info",
  neutral: "bg-muted-foreground",
}

const TEXT_COLOR: Record<string, string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
  info: "text-info",
  neutral: "text-muted-foreground",
}

function StatusIndicator({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "success" | "warning" | "destructive" | "info" | "neutral"
  children: React.ReactNode
  className?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", TEXT_COLOR[tone], className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", DOT_COLOR[tone])} />
      {children}
    </span>
  )
}

export { StatusIndicator }
