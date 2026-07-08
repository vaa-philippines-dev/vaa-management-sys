import { Skeleton } from "@/components/ui/skeleton"

export default function HistoryLoading() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-48" />
      </div>

      <div className="rounded-xl border p-3">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>

      <div className="rounded-xl border divide-y">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3 p-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-4 w-16 rounded-full" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-3 w-64" />
            </div>
            <Skeleton className="h-6 w-12 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}
