# VA Management System — Documentation

## 1. Architectural Layout

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js 16 (App Router)                │
│                                                             │
│  ┌────────────┐   ┌─────────────────┐   ┌───────────────┐  │
│  │ Auth Pages  │   │ Dashboard Pages │   │  API Routes   │  │
│  │ /login      │   │ /tasks          │   │ /tasks/[id]/  │  │
│  │ /callback   │   │ /vas            │   │   upload      │  │
│  └──────┬──────┘   └────────┬────────┘   └───────┬───────┘  │
│         │                   │                    │          │
│  ┌──────┴───────────────────┴────────────────────┴──────┐   │
│  │              Server Actions (lib/prisma)              │   │
│  └────────────────────────┬──────────────────────────────┘   │
│                           │                                  │
│  ┌────────────────────────┴──────────────────────────────┐   │
│  │              Supabase Client (SSR / Browser)           │   │
│  └────────────────────────┬──────────────────────────────┘   │
└───────────────────────────┼──────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │        Supabase           │
              │  ┌─────────────────────┐  │
              │  │   PostgreSQL (DB)    │  │
              │  │   + Auth (SSO)       │  │
              │  │   + Realtime         │  │
              │  └─────────────────────┘  │
              └───────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │    Google APIs (async)     │
              │  ┌─────────────────────┐  │
              │  │  Drive SDK           │  │
              │  │  (folders/files)     │  │
              │  └─────────────────────┘  │
              │  ┌─────────────────────┐  │
              │  │  Sheets SDK          │  │
              │  │  (task sync)         │  │
              │  └─────────────────────┘  │
              └───────────────────────────┘
```

### Data Flow
1. **UI → Supabase**: Every mutation goes through Server Actions → Prisma → PostgreSQL. The UI never calls Google APIs directly.
2. **Supabase → Google (async)**: After a successful DB write, Google SDK calls are fired as background promises (fire-and-forget). Errors are logged but never block the response.
3. **Google Drive → Supabase (metadata only)**: File uploads stream to Drive via the API route handler. Only the resulting Drive URL is stored in the DB.
4. **Real-time**: Supabase Realtime broadcasts `tasks` table changes to all connected clients. The `RealtimeProvider` component subscribes and triggers UI updates.

## 2. Database Schema

### Tables

#### `users`
| Column | Type | Constraints |
|---|---|---|
| id | String (cuid) | PK |
| email | String | UNIQUE, NOT NULL |
| name | String? | |
| role | UserRole (MANAGER / VA) | NOT NULL |
| department | String? | Used for scoping |
| avatar_url | String? | |
| created_at | DateTime | @default(now()) |
| updated_at | DateTime | @updatedAt |

**RLS**: Users can read their own row. MANAGERs can read all.

#### `va_profiles`
| Column | Type | Constraints |
|---|---|---|
| id | String (cuid) | PK |
| user_id | String | UNIQUE, FK → users.id CASCADE |
| phone | String? | |
| hourly_rate | Decimal? | |
| notes | String? | |
| is_active | Boolean | @default(true) |
| created_at | DateTime | @default(now()) |
| updated_at | DateTime | @updatedAt |

**RLS**: MANAGERs can read VAs in their department. VAs can read their own profile.

#### `tasks`
| Column | Type | Constraints |
|---|---|---|
| id | String (cuid) | PK |
| title | String | NOT NULL |
| description | String? | |
| priority | TaskPriority (LOW / MEDIUM / HIGH / URGENT) | @default(MEDIUM) |
| status | TaskStatus (BACKLOG / TODO / IN_PROGRESS / REVIEW / DONE / CANCELLED) | @default(TODO) |
| due_date | DateTime? | |
| google_drive_folder_url | String? | |
| department | String? | Mirrors VA department |
| assigned_to_id | String | FK → va_profiles.id |
| assigned_by_id | String | FK → users.id |
| created_at | DateTime | @default(now()) |
| updated_at | DateTime | @updatedAt |

**Indexes**: `assigned_to_id`, `assigned_by_id`, `department`

**RLS**:
- MANAGERs see tasks where `department` matches their department
- VAs see tasks where `assigned_to_id` matches their profile
- Only MANAGERs can INSERT tasks
- Both MANAGERs and the assigned VA can UPDATE

### Enums
- `UserRole`: `MANAGER`, `VA`
- `TaskPriority`: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- `TaskStatus`: `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`, `CANCELLED`

## 3. OAuth & Environment Setup

### Required Google Cloud Console Scopes (Service Account)
- `https://www.googleapis.com/auth/drive.file` — Create/read Drive folders and files
- `https://www.googleapis.com/auth/spreadsheets` — Read/write Sheets data

### Required Google Cloud Console Scopes (OAuth for Manager SSO)
- `openid`, `email`, `profile`

### Environment Variables (`.env.local`)
```env
# Supabase
DATABASE_URL="postgresql://postgres:password@localhost:5432/postgres"
NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

# Google Cloud (Service Account)
GOOGLE_SERVICE_ACCOUNT_EMAIL="your-sa@project.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
GOOGLE_DRIVE_PARENT_FOLDER_ID="root-folder-id-in-google-drive"
GOOGLE_SHEET_ID="spreadsheet-id-for-sync"

# Next
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
```

### Supabase Setup
1. Create a Supabase project
2. Enable Google OAuth provider in Authentication → Providers
3. Copy Site URL, Anon Key, and Service Role Key to `.env.local`
4. Enable Realtime on the `tasks` table: Go to Database → Replication → enable for `tasks`

### Prisma Setup
```bash
npm run db:migrate        # Create initial migration
npm run db:seed           # Seed demo data
npm run db:studio         # Open Prisma Studio
```

## 4. Changelog

### 2026-06-25 — Initial scaffold

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | Full DB schema with User, VAProfile, Task models + enums |
| `types/index.ts` | Shared TypeScript types |
| `lib/prisma.ts` | Prisma client singleton |
| `lib/utils.ts` | cn() utility (ShadCN) |
| `lib/supabase/client.ts` | Browser-side Supabase client |
| `lib/supabase/server.ts` | Server-side Supabase client (cookie-based) |
| `lib/auth.ts` | Server-side auth helpers (getCurrentUser, requireManager, requireVA) |
| `lib/google/drive.ts` | Google Drive SDK: createFolder, uploadFile |
| `lib/google/sheets.ts` | Google Sheets SDK: syncTasksToSheet (unidirectional) |
| `proxy.ts` | Auth guard proxy — redirects unauthenticated users to /login |
| `.env.example` | Template for all required environment variables |
| `app/layout.tsx` | Root layout with Toaster (Sonner) |
| `app/globals.css` | Tailwind v4 + ShadCN theme |
| `app/(auth)/layout.tsx` | Auth route group layout |
| `app/(auth)/login/page.tsx` | Login page: Manager SSO tab + VA email/password tab |
| `app/(auth)/callback/route.ts` | OAuth callback handler |
| `app/(dashboard)/layout.tsx` | Dashboard shell: Sidebar + Navbar + RealtimeProvider |
| `app/(dashboard)/page.tsx` | Redirects to /tasks |
| `app/(dashboard)/tasks/page.tsx` | Task list page with data grid |
| `app/(dashboard)/tasks/actions.ts` | Server Actions: createTask, updateTask, updateTaskStatus, deleteTask |
| `app/(dashboard)/tasks/new/page.tsx` | New task form page |
| `app/(dashboard)/tasks/[id]/page.tsx` | Task detail page |
| `app/(dashboard)/tasks/[id]/upload/route.ts` | File upload Route Handler → streams to Drive |
| `app/(dashboard)/vas/page.tsx` | VA list page (grid of cards) |
| `app/(dashboard)/vas/actions.ts` | Server Actions: signupVA, updateVA |
| `app/(dashboard)/vas/new/page.tsx` | New VA form page |
| `app/(dashboard)/vas/[id]/page.tsx` | VA edit page |
| `components/layout/Sidebar.tsx` | Navigation sidebar with route links + logout |
| `components/layout/Navbar.tsx` | Top navbar |
| `components/layout/RealtimeProvider.tsx` | Supabase Realtime subscription for tasks |
| `components/tasks/TaskDataGrid.tsx` | TanStack Table with sorting, filtering, inline status select |
| `components/tasks/TaskStatusBadge.tsx` | Color-coded status + priority badges |
| `components/tasks/TaskForm.tsx` | Create task form (Server Action + useActionState) |
| `components/tasks/TaskDetail.tsx` | Task detail view with status/reassign/upload controls |
| `components/vas/VAForm.tsx` | Create/edit VA form |
| `components/LoadingSpinner.tsx` | Reusable loading spinner |
| `prisma/seed.ts` | Demo data: 1 manager, 3 VAs, 5 sample tasks |
| `DOCUMENTATION.md` | This file |
