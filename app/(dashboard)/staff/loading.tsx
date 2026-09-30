import { Skeleton } from '@/components/ui/skeleton'

export default function StaffLoading() {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-64" />
      </div>
      <Skeleton className="h-14 w-full rounded-lg" />
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="p-2 space-y-1">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <Skeleton className="h-6 w-6 rounded-full shrink-0" />
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-40 hidden md:block" />
              <Skeleton className="h-5 w-16 rounded-full ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
