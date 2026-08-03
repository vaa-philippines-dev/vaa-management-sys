import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CopyButton } from './CopyButton'
import { DecisionControls } from './DecisionControls'
import { formatDistanceToNow } from 'date-fns'

type Payload = Record<string, unknown>

export type SuggestionForCard = {
  id: string
  kind: 'VA_MATCH' | 'NO_MATCH_FOUND' | 'ONBOARDING_CHECKLIST' | 'WELCOME_MESSAGE' | 'STALLED_HANDOFF'
  status: 'PENDING' | 'APPROVED' | 'EDITED' | 'REJECTED' | 'SUPERSEDED'
  rank: number | null
  score: number | string | null
  rationale: string
  payload: unknown
  createdAt: Date
  decidedAt: Date | null
  decisionNote: string | null
  decidedBy: { firstName: string; lastName: string } | null
}

const KIND_LABEL: Record<SuggestionForCard['kind'], string> = {
  VA_MATCH: 'VA Match',
  NO_MATCH_FOUND: 'No Strong Match',
  ONBOARDING_CHECKLIST: 'Onboarding Checklist',
  WELCOME_MESSAGE: 'Welcome Draft',
  STALLED_HANDOFF: 'Stalled Handoff',
}

const KIND_VARIANT: Record<SuggestionForCard['kind'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  VA_MATCH: 'default',
  NO_MATCH_FOUND: 'destructive',
  ONBOARDING_CHECKLIST: 'secondary',
  WELCOME_MESSAGE: 'secondary',
  STALLED_HANDOFF: 'destructive',
}

const STATUS_LABEL: Record<SuggestionForCard['status'], string> = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  EDITED: 'Edited',
  REJECTED: 'Rejected',
  SUPERSEDED: 'Superseded',
}

function asPayload(value: unknown): Payload {
  return value && typeof value === 'object' ? (value as Payload) : {}
}

function str(payload: Payload, key: string): string | null {
  const v = payload[key]
  return typeof v === 'string' && v.trim() ? v : null
}

function VaMatchBody({ suggestion }: { suggestion: SuggestionForCard }) {
  const payload = asPayload(suggestion.payload)
  const vaName = str(payload, 'vaName') ?? 'Unnamed VA'
  const position = str(payload, 'position')
  const availability = str(payload, 'availability')
  const freeHours = typeof payload.freeHoursPerWeek === 'number' ? payload.freeHoursPerWeek : null
  const missingSkills = Array.isArray(payload.missingSkills) ? (payload.missingSkills as string[]) : []
  const concern = str(payload, 'concern')

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        {suggestion.rank != null && (
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold">
            {suggestion.rank}
          </span>
        )}
        <p className="text-sm font-semibold">{vaName}</p>
        {position && <span className="text-xs text-muted-foreground">· {position}</span>}
        {suggestion.score != null && (
          <Badge variant="outline" className="ml-auto shrink-0">
            {Number(suggestion.score).toFixed(0)}/100
          </Badge>
        )}
      </div>
      <p className="text-[13px] text-foreground/90">{suggestion.rationale}</p>
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {availability && <span>Availability: {availability}</span>}
        {freeHours != null && <span>{freeHours}h/week free</span>}
        {missingSkills.length > 0 && <span>Missing: {missingSkills.join(', ')}</span>}
      </div>
      {concern && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400">
          ⚠ {concern}
        </p>
      )}
    </div>
  )
}

function NoMatchBody({ suggestion }: { suggestion: SuggestionForCard }) {
  return <p className="text-[13px] text-foreground/90">{suggestion.rationale}</p>
}

function OnboardingChecklistBody({ suggestion }: { suggestion: SuggestionForCard }) {
  const payload = asPayload(suggestion.payload)
  const items = Array.isArray(payload.items)
    ? (payload.items as { title: string; detail: string; ownerRole: string; dueDayOffset: number }[])
    : []

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-foreground/90">{suggestion.rationale}</p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px]">
            <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Day {item.dueDayOffset}
            </span>
            <div>
              <span className="font-medium">{item.title}</span>
              <span className="text-muted-foreground"> — {item.detail}</span>
              <span className="text-muted-foreground"> ({item.ownerRole.replace('_', ' ')})</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function WelcomeMessageBody({ suggestion }: { suggestion: SuggestionForCard }) {
  const payload = asPayload(suggestion.payload)
  const subject = str(payload, 'subject')
  const body = str(payload, 'body') ?? ''

  return (
    <div className="space-y-2">
      <p className="text-[13px] text-foreground/90">{suggestion.rationale}</p>
      {subject && <p className="text-[12px] font-medium">Subject: {subject}</p>}
      <div className="whitespace-pre-wrap rounded-md border bg-muted/30 p-2.5 text-[12px] text-foreground/90">
        {body}
      </div>
      <CopyButton text={subject ? `${subject}\n\n${body}` : body} />
    </div>
  )
}

function StalledHandoffBody({ suggestion }: { suggestion: SuggestionForCard }) {
  const payload = asPayload(suggestion.payload)
  const nextStep = str(payload, 'nextStep')

  return (
    <div className="space-y-1.5">
      <p className="text-[13px] text-foreground/90">{suggestion.rationale}</p>
      {nextStep && (
        <p className="rounded-md bg-amber-500/10 px-2 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
          Next step: {nextStep}
        </p>
      )}
    </div>
  )
}

const BODY_BY_KIND: Record<SuggestionForCard['kind'], React.ComponentType<{ suggestion: SuggestionForCard }>> = {
  VA_MATCH: VaMatchBody,
  NO_MATCH_FOUND: NoMatchBody,
  ONBOARDING_CHECKLIST: OnboardingChecklistBody,
  WELCOME_MESSAGE: WelcomeMessageBody,
  STALLED_HANDOFF: StalledHandoffBody,
}

export function AgentSuggestionCard({
  suggestion,
  canDecide,
}: {
  suggestion: SuggestionForCard
  canDecide: boolean
}) {
  const Body = BODY_BY_KIND[suggestion.kind]

  return (
    <Card>
      <CardContent className="space-y-2.5 pt-4">
        <div className="flex items-center gap-2">
          <Badge variant={KIND_VARIANT[suggestion.kind]}>{KIND_LABEL[suggestion.kind]}</Badge>
          {suggestion.status !== 'PENDING' && (
            <Badge variant="outline" className="text-muted-foreground">
              {STATUS_LABEL[suggestion.status]}
            </Badge>
          )}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {formatDistanceToNow(suggestion.createdAt, { addSuffix: true })}
          </span>
        </div>

        <Body suggestion={suggestion} />

        {suggestion.status === 'PENDING' && canDecide && <DecisionControls suggestionId={suggestion.id} />}

        {suggestion.status !== 'PENDING' && suggestion.decidedBy && (
          <p className="text-[11px] text-muted-foreground">
            {STATUS_LABEL[suggestion.status]} by {suggestion.decidedBy.firstName} {suggestion.decidedBy.lastName}
            {suggestion.decidedAt && ` · ${formatDistanceToNow(suggestion.decidedAt, { addSuffix: true })}`}
            {suggestion.decisionNote && ` — "${suggestion.decisionNote}"`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
