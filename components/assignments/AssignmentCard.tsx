import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type AssignmentRow = {
  id: string
  clientName: string
  vaName: string
  status: string
  agreedHours: number
  loggedHours: number
  startLabel: string
  endLabel: string | null
}

export function AssignmentCard({ a }: { a: AssignmentRow }) {
  return (
    <Link href={`/assignments/${a.id}`}>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 border-l-4 ${a.status === 'ACTIVE' ? 'border-l-green-500' : 'border-l-muted-foreground/30'}`}
      >
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div>
              <p className="text-sm font-semibold">{a.clientName}</p>
              <p className="text-xs text-muted-foreground">{a.vaName}</p>
            </div>
            <Badge variant={a.status === 'ACTIVE' ? 'default' : 'secondary'} className="shrink-0">
              {a.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3 text-xs">
            <div>
              <p className="text-muted-foreground">Agreed</p>
              <p className="font-medium">{a.agreedHours}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Logged</p>
              <p className="font-medium">{a.loggedHours.toFixed(1)}h</p>
            </div>
            <div>
              <p className="text-muted-foreground">Start</p>
              <p className="font-medium">{a.startLabel}</p>
            </div>
            <div>
              <p className="text-muted-foreground">{a.endLabel ? 'End' : 'Ongoing'}</p>
              <p className="font-medium">{a.endLabel ?? '—'}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
