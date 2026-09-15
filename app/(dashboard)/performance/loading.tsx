import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}
