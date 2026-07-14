import { Skeleton } from "@/components/ui/skeleton"

export default function AnniversaryLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="rounded-lg border bg-card divide-y">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between px-4 py-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-5 w-24 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  )
}
