import { cn } from '@/lib/utils'

export type StructurePerson = { firstName: string; lastName: string }

function userName(user: StructurePerson) {
  return `${user.firstName} ${user.lastName}`
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
  return (first + last).toUpperCase()
}

// Shared "who holds this role" card — used by the team detail page (single
// Team Leader / Temp Leader slot) and the department Structure page (DM/OM/
// Head, any of which can have zero, one, or multiple people per department
// since DepartmentMembership has no role uniqueness constraint). An empty
// `people` array renders "Vacant"; multiple entries stack as separate rows
// rather than truncating to one name, so a data problem (e.g. two Dept
// Managers) stays visible instead of being silently collapsed.
export function StructureCard({
  label,
  people,
  icon: Icon,
}: {
  label: string
  people: StructurePerson[]
  icon: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="rounded-lg border bg-card p-4 transition-shadow hover:shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className={cn('h-3.5 w-3.5', people.length > 0 ? 'text-primary' : 'text-muted-foreground/40')} />
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="mt-2 space-y-1.5">
        {people.length === 0 ? (
          <p className="text-sm font-semibold text-muted-foreground/60 font-normal">Vacant</p>
        ) : (
          people.map((person, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                {initials(userName(person))}
              </span>
              <p className="text-sm font-semibold">{userName(person)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
