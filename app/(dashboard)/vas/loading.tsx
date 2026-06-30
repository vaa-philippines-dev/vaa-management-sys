import { Skeleton } from "@/components/ui/skeleton"

export default function VALoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64" />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <Skeleton className="h-8 w-12" />
        </div>
      </div>

      <div className="rounded-xl border p-3">
        <Skeleton className="h-8 w-full rounded-md" />
      </div>

      <div className="rounded-xl border">
        <div className="p-3 border-b bg-muted/40">
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16 ml-auto" />
          </div>
        </div>
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 border-b last:border-0">
              <Skeleton className="h-7 w-7 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-2.5 w-48" />
              </div>
              <Skeleton className="h-4 w-16 rounded-full shrink-0" />
              <Skeleton className="h-4 w-12 rounded-full shrink-0" />
              <Skeleton className="h-4 w-12 rounded-full shrink-0 hidden sm:block" />
              <Skeleton className="h-7 w-16 rounded-md shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
