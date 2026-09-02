import { Skeleton } from "@/components/ui/skeleton"

export default function LeaveLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="flex justify-end">
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>
      <div className="space-y-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-48" />
          </div>
        ))}
      </div>
    </div>
  )
}
