# Latest System Update — Offboarding & Personal Info Fields

**Context:** Changes below implement the feedback items from the 2026-08-04 Workforce System Feedback Review meeting with HR. All work is currently uncommitted on `main` (see `git status`).

## 1. Termination / Offboarding Workflow (new)

Replaces the old approach of silently flipping a VA's Engagement Status dropdown with a full, auditable offboarding process.

**How it works:**
- On a VA's profile page, an **Offboarding** card lets HR/Admin/VA-mutator roles click **Terminate**.
- The termination is classified into one of three types (per HR's requested taxonomy):
  - **Type A — EOC**: End of Contract (natural completion)
  - **Type B — Client-Initiated**: client requested the VA be removed
  - **Type C — VAA-Initiated**: resignation (voluntary) or removal (involuntary) by VAA
- **Scope** is chosen per termination: either a single **Assignment** (that client relationship ends, VA stays active elsewhere) or the **entire VA** (all assignments end).
- An **"Affects both parties"** flag can be set when the termination impacts both the client and VAA relationship.
- Submitting the form:
  - Auto-creates a system **Ticket** (new `TERMINATION` category, `HIGH` priority) so HR/Sys Admin can track it in the existing Tickets module.
  - Creates a `Termination` record linking the VA, optional Assignment, ticket, type, resulting employment status, reason, and effective date.
  - **Assignment-scoped** terminations complete immediately (assignment marked `COMPLETED` with an end date).
  - **Whole-VA** terminations kick off a longer workflow: `EXIT_SURVEY_PENDING` → `CLEARANCE_PENDING` → `COMPLETED`, and automatically:
    - Updates the VA's engagement status and end date, logs a `VAHistory` event, and closes out the current `EmploymentRecord`.
    - Generates a one-time **Exit Survey** invite link (14-day expiry, no login required).
    - Creates an **Exit Clearance** checklist.

**New: Exit Survey (public, tokenized, no login)**
- New route: `app/exit-survey/[token]/` — a departing VA opens their unique link, answers reason for leaving, open feedback, a yes/no recommend question, and optional comments.
- Submitting advances the termination workflow to `CLEARANCE_PENDING` and redirects to a "done" confirmation page.
- This is an intentional, audited exception to the "every Server Action needs an auth guard" rule (`scripts/check-action-auth.ts`'s `PUBLIC_TOKEN_ACTIONS` allowlist), mirroring the existing onboarding-link pattern.

**New: Exit Clearance checklist**
- Shown inline on the linked Ticket's detail page via a new **Termination panel**.
- HR/Admin check off: equipment returned, accounts revoked, documents submitted, final pay cleared — plus a free-text outstanding-balance note.
- Checking all four items auto-completes the termination (`workflowStatus: COMPLETED`, `completedAt` stamped); unchecking any item after completion reopens it back to `CLEARANCE_PENDING`.

**New database models:** `Termination`, `ExitSurveyInvite`, `ExitSurveyResponse`, `ExitClearance` — plus new enums `TerminationType` and `TerminationWorkflowStatus`, and a new `TERMINATION` value on `TicketCategory`.

## 2. New Personal/HR Info Fields

Added to `UserProfile` and surfaced in both the VA profile editor and the self-service onboarding form:

| Field | Purpose |
|---|---|
| `religion` | Personal detail requested by HR, now collected at onboarding and editable on the VA profile |
| `payoneerId` | Distinct from the existing `payoneerAccount` (email) — some VAs use a numeric Payoneer ID instead of/alongside the email. Renamed the existing field's label from "Payoneer" to **"Payoneer Email"** for clarity |

Onboarding form also now collects **Birth Date** and **Emergency Contact** (name/phone/relationship) up front, instead of only being editable later by an admin.

## 3. VA Profile: Hire Date field

Added `currentHireDate` on `VAProfile`, editable from the Employment section, and displayed separately from the pre-existing "Hired (Employment Record)" date — the two can now diverge (e.g. re-hire scenarios) instead of only having one ambiguous "Hired" value.

## Migrations added
- `prisma/migrations/phase_zj_religion_payoneer_id.sql`
- `prisma/migrations/phase_zk0_ticket_category_termination.sql`
- `prisma/migrations/phase_zk_termination_workflow.sql`
- Runner scripts: `scripts/run-phase-zj-migration.js`, `scripts/run-phase-zk-migration.js`

## Files touched (high level)
- **New:** `app/exit-survey/[token]/{page,actions}.tsx`, `app/exit-survey/[token]/done/page.tsx`, `components/exit-survey/ExitSurveyForm.tsx`, `components/tickets/TerminationPanel.tsx`
- **Modified:** `prisma/schema.prisma`, `app/(dashboard)/vas/actions.ts` (new `terminateVA`, `updateExitClearance`), `app/(dashboard)/vas/[id]/page.tsx`, `app/(dashboard)/tickets/[id]/page.tsx`, `components/vas/VAProfileEditor.tsx` (new `TerminationCard`), `app/onboard/[token]/{page,actions}.tsx`, `components/onboarding/OnboardingForm.tsx`, `scripts/check-action-auth.ts`

## Not yet done
- None of this is committed yet — recommend reviewing and committing once verified against a real DB (migrations need to be applied via the phase runner scripts, same pattern as prior phases).
