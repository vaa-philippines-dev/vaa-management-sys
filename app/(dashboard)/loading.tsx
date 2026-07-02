import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" />
        </div>
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" />
        </div>
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" />
        </div>
        <div className="rounded-xl border p-5 space-y-3">
          <Skeleton className="h-3 w-20" /><Skeleton className="h-7 w-12" />
        </div>
      </div>
      <div className="rounded-xl border p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        <div className="space-y-2">
          {[1,2,3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-1.5"><Skeleton className="h-4 w-36" /><Skeleton className="h-3 w-56" /></div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
