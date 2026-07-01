import { Skeleton } from "@/components/ui/skeleton"

export default function ReportsLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-56" />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-12" />
        </div>
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <Skeleton className="h-5 w-36" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
