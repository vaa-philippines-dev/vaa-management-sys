import { Skeleton } from "@/components/ui/skeleton"

export default function TeamDetailLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-8 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
      <div className="rounded-lg border bg-card p-5 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  )
}
