# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` / `npm run build` / `npm run start` / `npm run lint` (also runs `check:action-auth`, a guard that fails if any `actions.ts` Server Action lacks an auth guard call)
- `npm run db:migrate` — `prisma migrate dev`
- `npm run db:push` — `prisma db push`
- `npm run db:seed` — runs `prisma/seed.ts` via `tsx`
- `npm run db:studio` — `prisma studio`
- `postinstall` runs `prisma generate` automatically after `npm install`.
- **There is no test runner configured** (no `test` script, no jest/vitest/playwright). Don't assume one exists or invent one unprompted.

## Next.js 16 specifics

This is a bleeding-edge Next.js 16.2.9 + React 19.2.4 + Tailwind v4 (CSS-first config, no `tailwind.config.js`) + shadcn (`components.json`, style `base-nova`) stack. Before writing any Next.js-specific code (routing, config, file conventions), check `node_modules/next/dist/docs/01-app/` rather than relying on training data — conventions have changed. Two confirmed breaking changes already accounted for in this repo:

- **Proxy replaces Middleware**: route interception lives in `proxy.ts` at the repo root, exporting a `proxy()` function plus `config.matcher` — not `middleware.ts`.
- **Prisma 7 config model** (see below) moved out of `package.json`/schema comments into `prisma.config.ts`.

Routing: `app/(auth)/` holds login + the OAuth callback route; `app/(dashboard)/` holds every protected feature route (dashboard, departments, admin, vas, clients, assignments, work-logs, skills, reports, tickets, teams, inbox, celebrants, va-connections, settings); `app/api/` holds only endpoints that don't map to a page/action (PSGC address cascade lookups, file upload x2, a Google Drive debug route, two cron routes — `cron/check-hours` and `cron/sync-va-connections`). There is no `middleware.ts` — auth is enforced per-page (see Auth below).

## Data layer conventions

- Server Actions are the primary mutation mechanism, co-located per feature as `actions.ts` inside each route folder (`'use server'` at the top) — there is no centralized actions directory. The one exception is `admin/departments`, whose mutation logic lives in `lib/departments.ts` plus inline actions in components (`AddDepartmentForm`, `MergeWizard`, `SplitWizard`, `ServiceSelector`).
- Standard mutation pattern used throughout — follow it for new actions: auth guard (`requireAdminMutator()` etc. from `lib/auth.ts`) → validate/normalize input → Prisma mutation → `revalidatePath`/`revalidateTag` (via `lib/cache.ts`'s `CACHE_TAGS`) → `logAudit()` from `lib/audit.ts` (audit failures are swallowed so they never break the main mutation).
- Reads are plain async Server Components calling Prisma directly, frequently wrapped in `cached()` from `lib/cache.ts`, streamed with `<Suspense>` and a sibling `loading.tsx` per route.
- No React Query/SWR/Zustand/Redux. State flows through Server Components + Server Actions + `router.refresh()`. Live updates use Supabase Realtime via two providers in `components/layout/`: `RealtimeProvider.tsx` (general/task updates) and `ChannelRealtimeProvider.tsx` (Inbox messaging).

## Prisma 7 gotchas

- Config lives in `prisma.config.ts` (not `package.json`), using the `@prisma/adapter-pg` driver adapter.
- Prisma Client generates to a **custom path**, `src/generated/prisma`, not the default `node_modules/@prisma/client` — matters when importing the client or its types.
- Migrations are **not** a clean sequential `prisma migrate` history — schema evolution happened via hand-written `.sql` files in `prisma/migrations/` plus one-off phase-numbered runner scripts in `scripts/` (`run-phase*-migration.js`, `phase1-seed-levels.js`, etc.). Check `scripts/` to see how a given phase was actually applied before assuming `prisma migrate dev` alone captures schema history.

## Domain model

- `Department` is a self-referential tree with a `DepartmentLevel` enum (`EXECUTIVE | MANAGEMENT | SERVICE`) marking three structural root tiers. Three protected "Level records" (literally named `"Executive"`, `"Management"`, `"Service"` — see `lib/departments.ts`'s `LEVEL_RECORD_NAMES`/`isLevelRecord()`) anchor the tree and must stay excluded from assignable dropdowns, department cards, and service-linking UI. Departments can also be merged or split (`mergedIntoId`/`splitFromId`, `DepartmentStatus`), and now own `Team`s (see below).
- `Skill` is called a **"Service" in the UI** — e.g. the "Assign Services" button writes to `DepartmentSkill` rows. `DepartmentSkill` links a department to the skills/services it offers; `VASkill` links an individual VA's own skillset (with `Proficiency` and years of experience).
- `User` is the core identity, gated by `SystemRole` (`SUPER_ADMIN, SYSTEM_ADMIN, EXECUTIVE, DEPT_MANAGER, TEAM_LEADER, OPERATIONS_MANAGER, HR, STAFF, VA` — `EXECUTIVE` is intentionally view-only). Users join departments via `DepartmentMembership` (with an `isPrimary` flag). VAs additionally get a `VAProfile` (rates, capacity, availability, Drive-linked HR/onboarding documents) and their own `VASkill` rows. Beyond the base `requireRole()` checks, `lib/auth.ts` also exports per-feature role-group constants (`CLIENT_MUTATOR_ROLES`, `ASSIGNMENT_MUTATOR_ROLES`, `VA_MUTATOR_ROLES`, `TICKET_VIEW_ALL_ROLES`/`TICKET_MUTATOR_ROLES`, `TEAM_MANAGE_ROLES`, `TEAM_LEADER_ASSIGN_ROLES`) — use these instead of re-deriving role lists inline.
- Staffing: `Assignment` links a VA to a `Client`; `WorkLog` tracks hours logged against an assignment.
- `Team`/`TeamMembership`: a department-scoped roster with a `leaderId` plus two temp-leader slots (`tempLeader1Id`/`tempLeader2Id`) — team composition (add/remove members) is owned by Dept Manager (`TEAM_MANAGE_ROLES`), while who leads is owned by Operations Manager (`TEAM_LEADER_ASSIGN_ROLES`); see `lib/teams.ts`.
- Messaging ("Inbox"): `Channel` (`DEPARTMENT`/`DIRECT`/`ANNOUNCEMENTS` kinds) holds `Message`s (with replies, pins, mentions via `MessageMention`, forwarding) and per-user `ChannelRead`/`ChannelParticipant` state. Realtime delivery goes through `components/layout/ChannelRealtimeProvider.tsx`.
- `Notification` (types `NEW_ASSIGNMENT`/`HOURS_SHORTFALL`/`NEW_MESSAGE`/`MESSAGE_REPLY`) is written via `notify()` in `lib/notifications.ts`, surfaced by `components/layout/NotificationBell.tsx`.
- Support: `Ticket`/`TicketConversation`, optionally tied to a department or client.
- External sync: `VAConnectionRecord` is a raw mirror of the manager's "VAConnections" Google Sheet (load phase only, refreshed by the `cron/sync-va-connections` route); `ExternalSyncMapping` maps the sheet's external VA/Client IDs to internal `VAProfile`/`Client` ids. Turning a synced row into an actual `Assignment` is a separate, not-yet-wired "connect" phase — see `lib/sync/`.
- `Project`: the DMF sheet's "Projects/Proposals" tab — department-owned internal initiatives (programs, trainings, budget requests, internal tooling) with a `ProjectStatus` review/approval cycle and the sheet's own `ProjectPriority` labels (Normal/Important/Critical). Deliberately has no Client/Assignment link: nothing here is billable or VA-staffed.
- Everything mutation-worthy writes to `AuditLog` (polymorphic `entityType`/`entityId` + JSON before/after diff) via `lib/audit.ts`.
- `RoleAssignment` grants temporary elevated access (`CONTRIBUTOR/VIEWER/APPROVER`) scoped to a module and optionally a department, independent of a user's base `SystemRole` — this backs `hasModuleAccess()` in `lib/auth.ts`.


## The Department Monitoring File (DMF)

Most of the department-facing UI is a port of one Google Sheet — "Amazon | Department Monitoring File 2026" — which managers still run day to day. The service account already has read access; the id is in `GOOGLE_DEPT_MONITORING_SHEET_ID` (read it with the same `googleapis` + `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`GOOGLE_PRIVATE_KEY` auth as `lib/google/va-connections-sheet.ts`). **No code reads it yet** — every port so far was transcribed by hand, so check the live tab before assuming a column doesn't exist.

Tab → app mapping as it stands:

| Sheet tab | In-app |
|---|---|
| DASHBOARD | `/dashboard?dept=<id>` |
| Masterlist | `/vas` |
| Team Assignment | `/team-assignment` |
| Structure | `/departments/[id]` |
| Headcount | partial — `DepartmentHeadcountCard` + `/reports/headcount`; the sheet's ~108-metric monthly/weekly time series is not ported |
| Performance Monitoring | partial — `AssignmentKpiCheck` covers the D4/W1/W2/M1/M2/M3/M6 columns; the W2 and M6 **client feedback** blocks are not ported |
| VA Availability | partial — only the aggregate buckets in `DepartmentHeadcountCard`; the per-VA hours ledger, RECOMMENDED tracking and DMF/TMF staleness alerts are not ported |
| Projects/Proposals | `/projects` (`Project` model) |
| VA Preparation | **not ported** — the pre-launch pipeline for a VA-client engagement (client meeting → preparation call → mock interview → VA connect → a 9-item onboarding checklist → live), plus its own EOC/pause block. `DepartmentDataIssuesCard`'s third rule is stubbed pending it. |
| IDLE VAs, VA-Client Summary, VA Concerns, Pending Dept Requests, Trainings, Discrepancies | not ported |

## Auth

- Supabase Auth (`@supabase/ssr`) is identity-only; the Prisma `User` table is the actual authorization source of truth. The OAuth callback (`app/(auth)/callback/route.ts`) rejects and signs out any Supabase session with no matching Prisma `User` row.
- Key helpers in `lib/auth.ts`: `getCurrentUser()`, `requireAuth()`, `requireRole()`, `requireSuperAdmin()`, `requireAdminMutator()` (blocks `EXECUTIVE` — view-only by design), `requireManager()`, `requireVA()`, `canMutate()`, `hasModuleAccess()`, plus `getPrimaryDepartment()`/`getManagedDepartmentIds()` for department-scoped manager checks.
- `proxy.ts` only redirects unauthenticated requests away from protected paths (or to `/login` if Supabase itself isn't configured) — it does not check roles. Each protected page still calls `getCurrentUser()` and checks roles itself, redirecting as needed.
- If Supabase isn't configured, `getCurrentUser()` returns `null` (no session, not logged in) and `proxy.ts` redirects protected paths to `/login`. Configure `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` to test authenticated flows locally.
- **Dev auth bypass exists**: if `NODE_ENV !== 'production'` and `DEV_AUTH_BYPASS_EMAIL` is set, both `proxy.ts` and `getCurrentUser()` (in `lib/auth.ts`) short-circuit to log in as that email directly — used for local testing of multi-user realtime flows (e.g. Inbox) without two real Google OAuth logins. This var must never be set on Vercel/production; the checks are no-ops there since `NODE_ENV` is always `'production'` in that environment.

## UI conventions

- shadcn/ui primitives live in `components/ui/` (button, card, input, table, badge, modal, skeleton, sonner, scroll-area, label, progress, circular-progress, status-indicator, pagination, dropdown-menu, textarea) — extend this set via the shadcn CLI rather than hand-rolling new primitives.
- Feature components are grouped by domain under `components/` (admin/, vas/, clients/, assignments/, work-logs/, skills/, reports/, tickets/, teams/, inbox/, settings/, auth/, layout/, filters/, loading/).
- Toasts use `sonner`; dark mode uses `next-themes` via `components/layout/ThemeToggle.tsx`.

## Stale documentation warning

`DOCUMENTATION.md` at the repo root describes an earlier, simpler schema (Users/VAProfile/Task) that no longer matches reality — treat it as historical, not authoritative. `README.md`'s schema section is also a partial/simplified subset of the real model. Always trust `prisma/schema.prisma` over both.
