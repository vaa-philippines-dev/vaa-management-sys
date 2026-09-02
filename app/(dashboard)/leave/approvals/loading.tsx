import { Skeleton } from "@/components/ui/skeleton"

export default function LeaveApprovalsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-40" />
      <div className="space-y-2.5">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-56" />
            <div className="flex gap-2 pt-1">
              <Skeleton className="h-7 w-20 rounded-md" />
              <Skeleton className="h-7 w-20 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
