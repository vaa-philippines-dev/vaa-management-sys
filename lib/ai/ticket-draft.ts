import Groq from 'groq-sdk'

/**
 * AI-assisted bug report drafting: takes a screenshot (and optional VA notes)
 * and returns a structured ticket draft, so non-technical VAs don't have to
 * describe the bug in words themselves.
 *
 * Provider is isolated behind this module on purpose — this is a prototype
 * built against Groq's free tier; once the project is approved the plan is
 * to swap this for the Claude API. Callers only depend on `draftTicketFromReport`
 * and `TicketDraft`, not on any Groq-specific types.
 */

export type TicketDraft = {
  title: string
  description: string
  category: 'TECHNICAL' | 'HR' | 'CLIENT' | 'VA_SUPPORT' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

const MODEL = 'meta-llama/llama-4-scout-17b-16e-instruct'

const DRAFT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short, specific bug title (max ~80 chars)' },
    description: {
      type: 'string',
      description:
        'Clear technical description: what the user was trying to do, what happened instead, and any visible error text. Written for a developer, not the VA.',
    },
    category: { type: 'string', enum: ['TECHNICAL', 'HR', 'CLIENT', 'VA_SUPPORT', 'GENERAL'] },
    priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
  },
  required: ['title', 'description', 'category', 'priority'],
  additionalProperties: false,
} as const

const SYSTEM_INSTRUCTION = `You help non-technical virtual assistants report software bugs.
You will be given a screenshot of the problem and optionally a short note from the VA in their own words.
Write a clear, specific bug report a developer can act on immediately: what the user was doing, what went wrong, and any visible error text or UI state.
Do not invent details that aren't visible in the screenshot or stated in the note. If something is unclear, describe only what you can observe.
Pick the most fitting category and a priority reflecting how much the bug blocks the VA's work (URGENT = completely blocked, HIGH = major feature broken, MEDIUM = workaround exists, LOW = cosmetic/minor).
Respond with JSON only, matching the given schema.`

let client: Groq | null = null

function getClient(): Groq {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY not configured')
    client = new Groq({ apiKey })
  }
  return client
}

const MAX_ATTEMPTS = 3
const RETRY_STATUS_CODES = new Set([429, 503])

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isRetryable(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  return typeof status === 'number' && RETRY_STATUS_CODES.has(status)
}

export async function draftTicketFromReport(input: {
  screenshotBase64: string
  screenshotMimeType: string
  vaNote?: string
}): Promise<TicketDraft> {
  const { screenshotBase64, screenshotMimeType, vaNote } = input

  const noteText = vaNote?.trim()
    ? `The VA's note about what happened: "${vaNote.trim()}"`
    : 'The VA did not write a note — infer what you can from the screenshot alone.'

  let lastError: unknown
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const response = await getClient().chat.completions.create({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_INSTRUCTION },
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${screenshotMimeType};base64,${screenshotBase64}` } },
              { type: 'text', text: noteText },
            ],
          },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'ticket_draft', schema: DRAFT_JSON_SCHEMA, strict: true },
        },
      })

      const text = response.choices[0]?.message?.content
      if (!text) throw new Error('Empty response from AI draft model')

      return JSON.parse(text) as TicketDraft
    } catch (error) {
      lastError = error
      if (attempt < MAX_ATTEMPTS && isRetryable(error)) {
        await sleep(1000 * 2 ** (attempt - 1)) // 1s, 2s
        continue
      }
      break
    }
  }

  if (isRetryable(lastError)) {
    throw new Error('The AI drafting service is temporarily overloaded. Please try again in a moment.')
  }
  throw lastError
}
