import { Mail } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <Badge variant="secondary">In Progress</Badge>
      </div>

      <div className="max-w-md rounded-xl border bg-card p-5 space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3.5 w-3.5" />
          <span>
            For more concerns, just email Neil (Developer) via{' '}
            <a href="mailto:business-support@vaaphilippines.com" className="font-medium text-foreground underline underline-offset-2">
              business-support@vaaphilippines.com
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}
