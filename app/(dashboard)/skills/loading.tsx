import { Skeleton } from "@/components/ui/skeleton"

export default function SkillsLoading() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-7 w-32" />
      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-3.5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-3 space-y-2.5">
        <div className="flex gap-2">
          <Skeleton className="h-9 flex-1 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-2.5 space-y-2 border-b bg-muted/40">
          <div className="flex gap-4">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-4 p-2.5 border-b last:border-0">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20 hidden sm:block" />
            <Skeleton className="h-3 w-12 hidden md:block" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-3 w-12 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
