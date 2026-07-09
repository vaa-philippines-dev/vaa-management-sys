import { GoogleGenAI, Type } from '@google/genai'

/**
 * AI-assisted bug report drafting: takes a screenshot (and optional VA notes)
 * and returns a structured ticket draft, so non-technical VAs don't have to
 * describe the bug in words themselves.
 *
 * Provider is isolated behind this module on purpose — this is a prototype
 * built against Gemini's free tier; once the project is approved the plan is
 * to swap this for the Claude API. Callers only depend on `draftTicketFromReport`
 * and `TicketDraft`, not on any Gemini-specific types.
 */

export type TicketDraft = {
  title: string
  description: string
  category: 'TECHNICAL' | 'HR' | 'CLIENT' | 'VA_SUPPORT' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
}

const DRAFT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: 'Short, specific bug title (max ~80 chars)' },
    description: {
      type: Type.STRING,
      description:
        'Clear technical description: what the user was trying to do, what happened instead, and any visible error text. Written for a developer, not the VA.',
    },
    category: { type: Type.STRING, enum: ['TECHNICAL', 'HR', 'CLIENT', 'VA_SUPPORT', 'GENERAL'] },
    priority: { type: Type.STRING, enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] },
  },
  required: ['title', 'description', 'category', 'priority'],
} as const

const SYSTEM_INSTRUCTION = `You help non-technical virtual assistants report software bugs.
You will be given a screenshot of the problem and optionally a short note from the VA in their own words.
Write a clear, specific bug report a developer can act on immediately: what the user was doing, what went wrong, and any visible error text or UI state.
Do not invent details that aren't visible in the screenshot or stated in the note. If something is unclear, describe only what you can observe.
Pick the most fitting category and a priority reflecting how much the bug blocks the VA's work (URGENT = completely blocked, HIGH = major feature broken, MEDIUM = workaround exists, LOW = cosmetic/minor).`

let client: GoogleGenAI | null = null

function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) throw new Error('GEMINI_API_KEY not configured')
    client = new GoogleGenAI({ apiKey })
  }
  return client
}

export async function draftTicketFromReport(input: {
  screenshotBase64: string
  screenshotMimeType: string
  vaNote?: string
}): Promise<TicketDraft> {
  const { screenshotBase64, screenshotMimeType, vaNote } = input

  const response = await getClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: screenshotMimeType, data: screenshotBase64 } },
          {
            text: vaNote?.trim()
              ? `The VA's note about what happened: "${vaNote.trim()}"`
              : 'The VA did not write a note — infer what you can from the screenshot alone.',
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: 'application/json',
      responseSchema: DRAFT_SCHEMA,
    },
  })

  const text = response.text
  if (!text) throw new Error('Empty response from AI draft model')

  const parsed = JSON.parse(text) as TicketDraft
  return parsed
}
