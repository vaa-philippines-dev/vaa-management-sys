# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- `npm run dev` / `npm run build` / `npm run start` / `npm run lint`
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

Routing: `app/(auth)/` holds login + the OAuth callback route; `app/(dashboard)/` holds every protected feature route (dashboard, departments, admin, vas, clients, assignments, work-logs, skills, reports); `app/api/` holds only endpoints that don't map to a page/action (PSGC address cascade lookups, file upload, a Google Drive debug route). There is no `middleware.ts` — auth is enforced per-page (see Auth below).

## Data layer conventions

- Server Actions are the primary mutation mechanism, co-located per feature as `actions.ts` inside each route folder (`'use server'` at the top) — there is no centralized actions directory. The one exception is `admin/departments`, whose mutation logic lives in `lib/departments.ts` plus inline actions in components (`AddDepartmentForm`, `MergeWizard`, `SplitWizard`, `ServiceSelector`).
- Standard mutation pattern used throughout — follow it for new actions: auth guard (`requireAdminMutator()` etc. from `lib/auth.ts`) → validate/normalize input → Prisma mutation → `revalidatePath`/`revalidateTag` (via `lib/cache.ts`'s `CACHE_TAGS`) → `logAudit()` from `lib/audit.ts` (audit failures are swallowed so they never break the main mutation).
- Reads are plain async Server Components calling Prisma directly, frequently wrapped in `cached()` from `lib/cache.ts`, streamed with `<Suspense>` and a sibling `loading.tsx` per route.
- No React Query/SWR/Zustand/Redux. State flows through Server Components + Server Actions + `router.refresh()`. Live updates use Supabase Realtime via `components/layout/RealtimeProvider.tsx`, which wraps the dashboard layout.

## Prisma 7 gotchas

- Config lives in `prisma.config.ts` (not `package.json`), using the `@prisma/adapter-pg` driver adapter.
- Prisma Client generates to a **custom path**, `src/generated/prisma`, not the default `node_modules/@prisma/client` — matters when importing the client or its types.
- Migrations are **not** a clean sequential `prisma migrate` history — schema evolution happened via hand-written `.sql` files in `prisma/migrations/` plus one-off phase-numbered runner scripts in `scripts/` (`run-phase*-migration.js`, `phase1-seed-levels.js`, etc.). Check `scripts/` to see how a given phase was actually applied before assuming `prisma migrate dev` alone captures schema history.

## Domain model

- `Department` is a self-referential tree with a `DepartmentLevel` enum (`EXECUTIVE | MANAGEMENT | SERVICE`) marking three structural root tiers. Three protected "Level records" (literally named `"Executive"`, `"Management"`, `"Service"` — see `lib/departments.ts`'s `LEVEL_RECORD_NAMES`/`isLevelRecord()`) anchor the tree and must stay excluded from assignable dropdowns, department cards, and service-linking UI. Departments can also be merged or split (`mergedIntoId`/`splitFromId`, `DepartmentStatus`).
- `Skill` is called a **"Service" in the UI** — e.g. the "Assign Services" button writes to `DepartmentSkill` rows. `DepartmentSkill` links a department to the skills/services it offers; `VASkill` links an individual VA's own skillset (with `Proficiency` and years of experience).
- `User` is the core identity, gated by `SystemRole` (`SUPER_ADMIN, SYSTEM_ADMIN, EXECUTIVE, DEPT_MANAGER, STAFF, VA` — `EXECUTIVE` is intentionally view-only). Users join departments via `DepartmentMembership` (with an `isPrimary` flag). VAs additionally get a `VAProfile` (rates, capacity, availability, Drive-linked HR/onboarding documents) and their own `VASkill` rows.
- Staffing: `Assignment` links a VA to a `Client`; `WorkLog` tracks hours logged against an assignment.
- Support: `Ticket`/`TicketConversation`, optionally tied to a department or client.
- Everything mutation-worthy writes to `AuditLog` (polymorphic `entityType`/`entityId` + JSON before/after diff) via `lib/audit.ts`.
- `RoleAssignment` grants temporary elevated access (`CONTRIBUTOR/VIEWER/APPROVER`) scoped to a module and optionally a department, independent of a user's base `SystemRole` — this backs `hasModuleAccess()` in `lib/auth.ts`.

## Auth

- Supabase Auth (`@supabase/ssr`) is identity-only; the Prisma `User` table is the actual authorization source of truth. The OAuth callback (`app/(auth)/callback/route.ts`) rejects and signs out any Supabase session with no matching Prisma `User` row.
- Key helpers in `lib/auth.ts`: `getCurrentUser()`, `requireAuth()`, `requireRole()`, `requireSuperAdmin()`, `requireAdminMutator()` (blocks `EXECUTIVE` — view-only by design), `requireManager()`, `requireVA()`, `canMutate()`, `hasModuleAccess()`.
- There is no `middleware.ts`/proxy-based route protection for auth — each protected page calls `getCurrentUser()` and checks roles itself, redirecting as needed.
- Dev fallback: if Supabase isn't configured, `getCurrentUser()` falls back to the first `DEPT_MANAGER` user in the database — relevant when debugging local auth behavior that seems to ignore login state.

## UI conventions

- shadcn/ui primitives live in `components/ui/` (button, card, input, table, badge, modal, skeleton, sonner, scroll-area, label) — extend this set via the shadcn CLI rather than hand-rolling new primitives.
- Feature components are grouped by domain under `components/` (admin/, vas/, clients/, assignments/, work-logs/, skills/, reports/, layout/, filters/, loading/).
- Toasts use `sonner`; dark mode uses `next-themes` via `components/layout/ThemeToggle.tsx`.

## Stale documentation warning

`DOCUMENTATION.md` at the repo root describes an earlier, simpler schema (Users/VAProfile/Task) that no longer matches reality — treat it as historical, not authoritative. `README.md`'s schema section is also a partial/simplified subset of the real model. Always trust `prisma/schema.prisma` over both.
