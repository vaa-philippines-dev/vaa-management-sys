import { RefreshCwIcon } from 'lucide-react'

export function LoadingSpinner({ className }: { className?: string }) {
  return <RefreshCwIcon className={`animate-spin ${className ?? 'h-4 w-4'}`} />
}
