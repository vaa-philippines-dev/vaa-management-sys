import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, ShadingType,
  TableLayoutType, BorderStyle,
} from "docx";
import fs from "fs";
import path from "path";

const BLUE = "1F4E79";
const DARK = "333333";
const WHITE = "FFFFFF";
const LIGHT_GRAY = "F5F5F5";
const FULL = 9072;

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: border, bottom: border, left: border, right: border };

const h1 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE })],
    spacing: { before: 400, after: 200 },
  });

const h2 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 26, color: BLUE })],
    spacing: { before: 300, after: 150 },
  });

const h3 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: DARK })],
    spacing: { before: 200, after: 100 },
  });

const text = (t) =>
  new Paragraph({
    children: [new TextRun({ text: t, size: 20, color: DARK })],
    spacing: { after: 80 },
  });

const boldText = (label, value) =>
  new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 20, color: DARK }),
      new TextRun({ text: value, size: 20, color: DARK }),
    ],
    spacing: { after: 60 },
  });

const bullet = (t) =>
  new Paragraph({
    children: [new TextRun({ text: `\u2022  ${t}`, size: 20, color: DARK })],
    spacing: { after: 60 },
    indent: { left: 360 },
  });

const spacer = () => new Paragraph({ spacing: { after: 150 }, children: [] });

function makeTable(colWidths, headerTexts, rows, opts = {}) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const pct = (w) => Math.round((w / total) * FULL);
  const leftAlign = opts.leftAlign || false;

  const headerRow = new TableRow({
    tableHeader: true,
    children: headerTexts.map((h, i) =>
      new TableCell({
        width: { size: pct(colWidths[i]), type: WidthType.DXA },
        shading: { type: ShadingType.SOLID, color: BLUE },
        borders: cellBorders,
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: h, bold: true, size: 18, color: WHITE })],
          }),
        ],
      })
    ),
  });

  const dataRows = rows.map((r, ri) =>
    new TableRow({
      children: r.map((c, i) => {
        return new TableCell({
          width: { size: pct(colWidths[i]), type: WidthType.DXA },
          borders: cellBorders,
          shading: ri % 2 === 1 ? { type: ShadingType.SOLID, color: LIGHT_GRAY } : undefined,
          children: [
            new Paragraph({
              alignment: leftAlign ? AlignmentType.LEFT : AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [new TextRun({ text: String(c), size: 18, color: DARK })],
            }),
          ],
        });
      }),
    })
  );

  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: FULL, type: WidthType.DXA },
    rows: [headerRow, ...dataRows],
  });
}

const doc = new Document({
  styles: {
    default: {
      document: {
        run: { size: 20, font: "Calibri" },
      },
    },
  },
  sections: [
    {
      children: [
        // TITLE PAGE
        spacer(), spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "VAA Philippines", bold: true, size: 44, color: BLUE })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Virtual Assistant Management System", bold: true, size: 32, color: DARK })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "System Architecture, Database Schema, and Production Deployment Blueprint", size: 24, color: DARK })],
          spacing: { after: 200 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Version 2.0 - Full System Design", size: 20, color: "666666" })],
          spacing: { after: 60 },
        }),
        spacer(),
        text("Prepared for: VAA Philippines Operations Management"),
        text("Prepared by: Neil Andre Ibona, Development Team"),
        text("Date: June 26, 2026"),
        text("Classification: Internal - Confidential"),
        spacer(), spacer(),

        // 1. EXECUTIVE SUMMARY
        h1("1. Executive Summary"),
        text("The VAA Philippines Virtual Assistant Management System is a dual-facing Content Management System (CMS) designed to consolidate all organizational workflows into a single, scalable platform. It replaces fragmented tools including Google Sheets with broken import-range formulas, WhatsApp, Google Chat, and email threads with a unified system supporting manager and administrator access with granular role-based permissions."),
        spacer(),
        text("The system is designed to scale from the current ~3 VA operation to support 700-900 total users with an anticipated daily load of 15-50 active users. The architecture follows a four-phase development strategy: Department Hierarchy, VA Workforce, Client Workforce & Service Lines, and Consolidated Communications (Ticketing)."),
        spacer(),
        h3("Key Capabilities"),
        bullet("Dynamic department hierarchy with parent-child relationships"),
        bullet("Distinction between internal staff and Virtual Assistant roles with separate workflows"),
        bullet("Granular RBAC: Super Admin, System Admin, Executive, Department Manager, Contributor, Viewer"),
        bullet("Temporary role assignment for cross-department support without changing primary role"),
        bullet("Tenure tracking with separate records for VA tenure and staff promotion tenure"),
        bullet("Historical audit logging for service reorganizations, position moves, and status changes"),
        bullet("Employment status management: Employed, Engaged, Contracted, End of Contract, Transferred, Blacklisted"),
        bullet("Google Drive integration for contracts, clearance records, ID uploads, and portfolios"),
        bullet("Consolidated support ticketing system replacing WhatsApp, Gmail, Google Chat communication"),
        bullet("Comprehensive VA profiles including G-Cash, birthday, emergency contacts, social media, personality traits"),
        bullet("Leave management with distinct approval workflows for staff vs VAs"),
        spacer(),

        // 2. SYSTEM ARCHITECTURE
        h1("2. System Architecture Overview"),
        h3("Technology Stack"),
        makeTable(
          [1800, 2500, 4772],
          ["Layer", "Technology", "Rationale"],
          [
            ["Frontend", "Next.js 16 (App Router) + React 19 + TypeScript", "Server Components for performance, App Router for route groups"],
            ["UI Framework", "Tailwind CSS v4 + ShadCN/ui", "Component library with consistent design tokens"],
            ["Database", "PostgreSQL 16 (via Supabase)", "Relational integrity, JSONB for audit, Row-Level Security, partitioning"],
            ["ORM", "Prisma 7 + pg adapter", "Type-safe queries, migration tooling, schema-as-source-of-truth"],
            ["Auth", "Supabase Auth (Google SSO) + custom RBAC middleware", "Google OAuth with database-level access enforcement"],
            ["File Storage", "Google Drive API (via Service Account)", "Direct Drive integration for contracts, IDs, and documents"],
            ["Caching/Queue", "Redis 7 (Upstash managed)", "Session cache, rate limiting, background job queue"],
            ["Realtime", "Supabase Realtime (WebSockets)", "Live updates for tickets, assignments, and work logs"],
            ["Observability", "OpenTelemetry + Grafana (Loki/Tempo)", "Distributed tracing, structured logging, alerting"],
            ["Hosting", "Vercel Pro (Edge + Serverless)", "Global CDN, zero-config deployment, automatic HTTPS"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("High-Level Architecture"),
        text("The system follows a layered architecture with clear separation of concerns:"),
        spacer(),
        text("PRESENTATION LAYER: Next.js App Router with route groups for (auth), (dashboard-manager), (dashboard-va), (admin)"),
        text("  - Server Components for data fetching (no client-side API calls for reads)"),
        text("  - Client Components for interactive forms, realtime subscriptions, and file uploads"),
        text("  - Server Actions for all mutations (forms, status changes)"),
        spacer(),
        text("SERVICE LAYER:"),
        text("  - lib/auth.ts: Role-based middleware (requireSuperAdmin, requireManager, etc.)"),
        text("  - lib/google/drive.ts: Google Drive SDK wrapper for folder creation and file uploads"),
        text("  - lib/google/sheets.ts: Sheets sync for backward compatibility with legacy data"),
        text("  - lib/audit.ts: Centralized audit trail logger for all state changes"),
        spacer(),
        text("DATA LAYER:"),
        text("  - Prisma ORM with PostgreSQL adapter (lib/prisma.ts singleton)"),
        text("  - PostgreSQL Row-Level Security (RLS) policies enforced at database level"),
        text("  - Supabase Realtime for live data subscriptions on tickets and work logs"),
        spacer(),
        text("EXTERNAL LAYER:"),
        text("  - Google Drive API: Document storage, contract management, file portfolios"),
        text("  - Google Sheets API: Legacy data import/export bridge during migration"),
        text("  - Supabase Auth: Google SSO with session management"),
        spacer(),

        h3("Data Flow"),
        text("1. All mutations: Server Actions -> Prisma -> PostgreSQL. UI never calls external APIs directly."),
        text("2. Google Drive uploads: Streamed via API Route Handlers with background processing."),
        text("3. After successful DB writes, Google Sheets sync is fired as background promise (fire-and-forget)."),
        text("4. Audit trail: PostgreSQL triggers for all INSERT/UPDATE/DELETE on critical tables."),
        text("5. Realtime: Subscriptions push changes to connected clients for live collaboration."),
        spacer(),

        // 3. DATABASE SCHEMA
        h1("3. Database Schema - Complete Design"),
        text("The schema is organized into domain groups corresponding to the four implementation phases. All tables use CUID-based primary keys and include created_at/updated_at audit timestamps. Designed for 700+ users with proper indexing and partitioning strategies."),
        spacer(),

        h2("3.1 Core Organization (Phase 1 - Foundation)"),

        h3("departments"),
        text("Hierarchical department structure with parent-child nesting for org chart."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", "Unique identifier"],
            ["name", "String", "UNIQUE, NOT NULL", "Department name (e.g., Amazon Operations)"],
            ["parent_id", "String?", "FK -> departments.id SET NULL", "Parent for hierarchy (null = top-level)"],
            ["is_parent", "Boolean", "@default(false)", "True if category/grouping (not directly assignable)"],
            ["description", "String?", "", "Optional description"],
            ["head_id", "String?", "FK -> users.id", "Department head/manager"],
            ["sort_order", "Int", "@default(0)", "Display ordering"],
            ["is_active", "Boolean", "@default(true)", "Soft delete flag"],
            ["created_at", "DateTime", "@default(now())", ""],
            ["updated_at", "DateTime", "@updatedAt", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("positions"),
        text("Job positions within the org hierarchy defining reporting chain and approval workflows."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["title", "String", "NOT NULL", "Senior Manager, Specialist, VA, etc."],
            ["reports_to_id", "String?", "FK -> positions.id", "Supervisor position in chain"],
            ["department_id", "String?", "FK -> departments.id", "Owning department"],
            ["is_staff_role", "Boolean", "@default(false)", "True for internal staff, false for VA"],
            ["sort_order", "Int", "@default(0)", ""],
            ["is_active", "Boolean", "@default(true)", ""],
            ["created_at", "DateTime", "@default(now())", ""],
            ["updated_at", "DateTime", "@updatedAt", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("department_memberships"),
        text("Many-to-many join: users <-> departments with position context."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "FK -> users.id CASCADE", "The user"],
            ["department_id", "String", "FK -> departments.id CASCADE", "The department"],
            ["position_id", "String?", "FK -> positions.id", "Role within this department"],
            ["is_primary", "Boolean", "@default(false)", "Primary department for reporting"],
            ["started_at", "DateTime", "@default(now())", ""],
            ["ended_at", "DateTime?", "", "null = currently active"],
            ["@@unique([user_id, department_id])", "", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 3.2 USERS & PERSONNEL
        h2("3.2 Users & Personnel (Phase 1-2)"),

        h3("users"),
        text("Redesigned user table distinguishing staff from VAs with granular roles."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["email", "String", "UNIQUE, NOT NULL", "Login email (Google SSO)"],
            ["first_name", "String", "NOT NULL", "Given name"],
            ["last_name", "String", "NOT NULL", "Family name"],
            ["system_role", "SystemRole enum", "NOT NULL", "SUPER_ADMIN|SYSTEM_ADMIN|EXECUTIVE|DEPT_MANAGER|STAFF|VA"],
            ["user_type", "UserType enum", "NOT NULL", "INTERNAL_STAFF|VIRTUAL_ASSISTANT"],
            ["avatar_url", "String?", "", ""],
            ["is_active", "Boolean", "@default(true)", ""],
            ["created_at", "DateTime", "@default(now())", ""],
            ["updated_at", "DateTime", "@updatedAt", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("user_profiles"),
        text("Extended profile: G-Cash, birthday, emergency contacts, social media, personality traits."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "UNIQUE, FK -> users.id CASCADE", ""],
            ["phone", "String?", "", "Primary contact"],
            ["birth_date", "DateTime?", "", ""],
            ["address", "String?", "", ""],
            ["emergency_contact_name", "String?", "", ""],
            ["emergency_contact_phone", "String?", "", ""],
            ["emergency_contact_relation", "String?", "", ""],
            ["gcash_number", "String?", "", "G-Cash mobile number"],
            ["facebook_url", "String?", "", ""],
            ["linkedin_url", "String?", "", ""],
            ["personality_traits", "String[]", "", "For client matching (detail-oriented, engaging, etc.)"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("employment_records"),
        text("Employment lifecycle: tenure tracking, contract types, status changes, blacklist."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "FK -> users.id CASCADE", ""],
            ["contract_type", "ContractType enum", "NOT NULL", "REGULAR|PROJECT_BASED|PROBATIONARY"],
            ["employment_status", "EmploymentStatus enum", "NOT NULL", "EMPLOYED|ENGAGED|CONTRACTED|END_OF_CONTRACT|TRANSFERRED|RESIGNED|TERMINATED|BLACKLISTED"],
            ["start_date", "DateTime", "NOT NULL", ""],
            ["end_date", "DateTime?", "", ""],
            ["effective_date", "DateTime", "@default(now())", ""],
            ["reason", "String?", "", "Reason for status change"],
            ["initiated_by", "String?", "FK -> users.id", "HR or service dept initiator"],
            ["is_current", "Boolean", "@default(true)", "Active employment record"],
            ["tenure_days", "Int?", "", "Computed tenure at time of record"],
            ["notes", "String?", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("role_assignments"),
        text("Temporary/additional role elevations (Contributor, Viewer, Approver) per module."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "FK -> users.id CASCADE", ""],
            ["role", "TemporaryRole enum", "NOT NULL", "CONTRIBUTOR|VIEWER|APPROVER"],
            ["module", "String", "NOT NULL", "Target module (vas, clients, ticketing, reports)"],
            ["department_id", "String?", "FK -> departments.id", "Scope to specific department"],
            ["granted_by", "String", "FK -> users.id", ""],
            ["expires_at", "DateTime?", "", "Auto-expiry"],
            ["is_active", "Boolean", "@default(true)", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 3.3 VA WORKFORCE
        h2("3.3 VA Workforce (Phase 2)"),

        h3("va_profiles"),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "UNIQUE, FK -> users.id CASCADE", ""],
            ["hourly_rate", "Decimal?", "", "USD billing rate"],
            ["availability_status", "Availability enum", "@default(AVAILABLE)", "AVAILABLE|PARTIALLY_ASSIGNED|FULLY_ASSIGNED|ON_LEAVE|UNAVAILABLE"],
            ["total_capacity_hours", "Decimal?", "@default(40)", "Max weekly hours"],
            ["onboarding_folder_url", "String?", "", "Google Drive onboarding docs"],
            ["portfolio_url", "String?", "", "External portfolio / Drive link"],
            ["notes", "String?", "", ""],
            ["is_active", "Boolean", "@default(true)", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("va_skills"),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["va_profile_id", "String", "FK -> va_profiles.id CASCADE", ""],
            ["skill_id", "String", "FK -> skills.id CASCADE", ""],
            ["proficiency", "Proficiency enum", "@default(INTERMEDIATE)", "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT"],
            ["years_experience", "Decimal?", "", ""],
            ["is_primary", "Boolean", "@default(false)", "Core skill"],
            ["@@unique([va_profile_id, skill_id])", "", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("va_documents"),
        text("Contracts, IDs, clearances stored in Google Drive with metadata in DB."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["va_profile_id", "String", "FK -> va_profiles.id CASCADE", ""],
            ["document_type", "DocumentType enum", "NOT NULL", "CONTRACT|GOVERNMENT_ID|NDA|CLEARANCE|CERTIFICATE|OTHER"],
            ["file_name", "String", "NOT NULL", ""],
            ["google_drive_url", "String", "NOT NULL", "Drive file URL"],
            ["mime_type", "String", "", ""],
            ["file_size", "Int?", "", "Bytes"],
            ["uploaded_by", "String", "FK -> users.id", ""],
            ["expires_at", "DateTime?", "", "Document expiration"],
            ["notes", "String?", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("leave_requests"),
        text("Leave management for both staff and VAs with approval chains."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["user_id", "String", "FK -> users.id CASCADE", "Requestor"],
            ["leave_type", "LeaveType enum", "NOT NULL", "VACATION|SICK|EMERGENCY|MATERNITY|PATERNITY|UNPAID|BEREAVEMENT"],
            ["start_date", "DateTime", "NOT NULL", ""],
            ["end_date", "DateTime", "NOT NULL", ""],
            ["total_days", "Decimal", "", "Computed"],
            ["reason", "String?", "", ""],
            ["status", "LeaveStatus enum", "@default(PENDING)", "PENDING|APPROVED|REJECTED|CANCELLED"],
            ["approver_id", "String?", "FK -> users.id", ""],
            ["approved_at", "DateTime?", "", ""],
            ["approver_note", "String?", "", ""],
            ["notification_sent", "Boolean", "@default(false)", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 3.4 CLIENTS & ASSIGNMENTS
        h2("3.4 Clients & Service Lines (Phase 3)"),

        h3("clients"),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["name", "String", "NOT NULL", "Company/brand name"],
            ["contact_name", "String?", "", ""],
            ["contact_email", "String?", "", ""],
            ["contact_phone", "String?", "", ""],
            ["platform", "ClientPlatform enum", "@default(MULTI)", "AMAZON|WALMART|TIKTOK_SHOP|SHOPIFY|MULTI"],
            ["industry", "String?", "", ""],
            ["timezone", "String?", "@default('America/New_York')", ""],
            ["notes", "String?", "", ""],
            ["is_active", "Boolean", "@default(true)", ""],
            ["manager_id", "String?", "FK -> users.id", "Account manager"],
            ["department_id", "String?", "FK -> departments.id", "Servicing department"],
            ["onboarding_folder_url", "String?", "", "Google Drive folder"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("assignments"),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["type", "AssignmentType enum", "NOT NULL", "REGULAR|PROJECT"],
            ["status", "AssignmentStatus enum", "@default(ACTIVE)", "ACTIVE|PAUSED|COMPLETED|CANCELLED|ON_HOLD"],
            ["agreed_hours", "Decimal", "NOT NULL", ""],
            ["monthly_hours", "Decimal?", "", ""],
            ["start_date", "DateTime", "NOT NULL", ""],
            ["end_date", "DateTime?", "", ""],
            ["notes", "String?", "", ""],
            ["va_profile_id", "String", "FK -> va_profiles.id CASCADE", ""],
            ["client_id", "String", "FK -> clients.id CASCADE", ""],
            ["skill_requirements", "String[]", "", "Skills needed for this assignment"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 3.5 TICKETING
        h2("3.5 Communications & Ticketing (Phase 4)"),

        h3("tickets"),
        text("Centralized support system replacing WhatsApp, email, and chat threads."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["ticket_number", "String", "UNIQUE", "Auto-generated TKT-2026-0001"],
            ["title", "String", "NOT NULL", ""],
            ["description", "String?", "", ""],
            ["category", "TicketCategory enum", "NOT NULL", "TECHNICAL|HR|CLIENT|VA_SUPPORT|GENERAL"],
            ["priority", "Priority enum", "@default(MEDIUM)", "LOW|MEDIUM|HIGH|URGENT"],
            ["status", "TicketStatus enum", "@default(OPEN)", "OPEN|IN_PROGRESS|WAITING_ON_CLIENT|RESOLVED|CLOSED"],
            ["source", "TicketSource enum", "@default(INTERNAL)", "INTERNAL|EMAIL|WHATSAPP|CLIENT_PORTAL"],
            ["created_by", "String", "FK -> users.id", ""],
            ["assigned_to", "String?", "FK -> users.id", ""],
            ["department_id", "String?", "FK -> departments.id", ""],
            ["client_id", "String?", "FK -> clients.id", ""],
            ["resolved_at", "DateTime?", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("ticket_conversations"),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["ticket_id", "String", "FK -> tickets.id CASCADE", ""],
            ["user_id", "String", "FK -> users.id", "Message author"],
            ["message", "String", "NOT NULL", ""],
            ["is_internal_note", "Boolean", "@default(false)", "Not visible to clients"],
            ["attachments", "String[]", "", "Google Drive URLs"],
            ["created_at", "DateTime", "@default(now())", ""],
            ["@@index([ticket_id, created_at])", "", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 3.6 AUDIT TRAIL
        h2("3.6 Audit Trail & Historical Logging"),

        h3("audit_logs"),
        text("Immutable audit trail for all system changes. Tracks service reorganizations, position moves, and status transitions."),
        makeTable(
          [1600, 1600, 1600, 4272],
          ["Column", "Type", "Constraints", "Description"],
          [
            ["id", "String (cuid)", "PK", ""],
            ["actor_id", "String", "FK -> users.id", "Who performed the action"],
            ["action", "AuditAction enum", "NOT NULL", "CREATE|UPDATE|DELETE|STATUS_CHANGE|TRANSFER|APPROVE|REJECT"],
            ["entity_type", "String", "NOT NULL", "Affected model"],
            ["entity_id", "String", "NOT NULL", "Affected record ID"],
            ["old_values", "Json?", "", "Previous state snapshot"],
            ["new_values", "Json?", "", "New state snapshot"],
            ["metadata", "Json?", "", "IP, user agent, etc."],
            ["department_id", "String?", "FK -> departments.id", "Scope"],
            ["created_at", "DateTime", "@default(now())", ""],
            ["@@index([entity_type, entity_id, created_at])", "", "", ""],
            ["@@index([actor_id, created_at])", "", "", ""],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 4. ACCESS CONTROL
        h1("4. Access Control & RBAC"),

        h3("System Roles"),
        makeTable(
          [2000, 3500, 3572],
          ["Role", "Permissions", "Who Gets This"],
          [
            ["SUPER_ADMIN", "Full system access: all modules, config, user mgmt, audit logs", "IT/Operations Head"],
            ["SYSTEM_ADMIN", "User mgmt, department config, role assignment. No data deletion or config changes.", "Senior Admin Staff"],
            ["EXECUTIVE", "Read-only across all modules, reports, dashboards. No modifications.", "CEO, CMO, COO, Senior Managers"],
            ["DEPT_MANAGER", "Full access within their department scope. Cross-dept only if granted.", "Department Heads, Service Leads"],
            ["STAFF", "Read/write within department scope. Create tickets, log work, view own data.", "Internal Staff"],
            ["VA", "Read/write own profile, assignments, work logs, tickets. Cannot see other VAs or financials.", "Virtual Assistants"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        h3("Temporary Roles"),
        text("Temporary role elevations allow staffing flexibility without changing primary permissions:"),
        bullet("CONTRIBUTOR: Create and edit within a specific module and department scope"),
        bullet("VIEWER: Read-only access to a specific module and department scope"),
        bullet("APPROVER: Approve leave requests, status changes within scope"),
        text("These roles auto-expire based on expires_at or are manually revoked. Audit logs record all grants and revocations."),
        spacer(),

        h3("View-As Feature"),
        text("Super Admin and System Admin can preview the system from another role's perspective without logging out. This is a UI-layer toggle that applies the target role's RLS policies for the session."),
        spacer(),

        // 5. PHASE 1
        h1("5. Phase 1: Department Hierarchy"),
        text("Foundation of the entire system. Establishes org structure that all other modules depend on."),
        spacer(),
        bullet("Create departments table with self-referencing parent_id for hierarchy"),
        bullet("Create positions table with reports_to chain"),
        bullet("Create department_memberships for many-to-many user-department relationships"),
        bullet("Migrate existing users to new schema with proper department assignments"),
        bullet("Build department management UI (admin-only CRUD)"),
        bullet("Organizational chart visualization component"),
        spacer(),
        boldText("RLS Policy: ", "Managers read/write within their department scope. Super/System Admins have full access."),
        spacer(),

        // 6. PHASE 2
        h1("6. Phase 2: VA Workforce Management"),
        text("Comprehensive VA management with enhanced profiles, skill matching, documents, and leave."),
        spacer(),
        bullet("Enhanced VA profiles with full personal data (G-Cash, birthday, emergency contacts, social media)"),
        bullet("Skills management with proficiency levels and years of experience"),
        bullet("Employment records with tenure tracking (separate VA vs staff promotion tenure)"),
        bullet("Document management integrated with Google Drive (contracts, IDs, clearances)"),
        bullet("Leave request workflow with department-level approval chain"),
        bullet("Availability status tracking and capacity management"),
        bullet("Blacklist management for restricted rehire tracking"),
        bullet("Personality trait capture for future client matching"),
        spacer(),
        boldText("Key Workflow: ", "Leave requests for VAs route to department manager. Staff leave follows position reports_to chain. Approver receives email/push notification."),
        spacer(),

        // 7. PHASE 3
        h1("7. Phase 3: Client Workforce & Service Lines"),
        text("Client management, service line configuration, and VA-client assignment matching engine."),
        spacer(),
        bullet("Enhanced client profiles with onboarding folders and department assignment"),
        bullet("Service line modules mapped to departments (Amazon Services, Shopify Support, etc.)"),
        bullet("Skill-based VA-to-client matching algorithm (suggest top 3 VAs per client requirements)"),
        bullet("Assignment lifecycle management with status workflow"),
        bullet("Google Drive integration for client onboarding document storage"),
        bullet("Historical logging for service/position moves between departments"),
        bullet("Reporting and dashboards per client (hours, utilization, assignment status)"),
        spacer(),

        // 8. PHASE 4
        h1("8. Phase 4: Consolidated Communications & Ticketing"),
        text("Replaces fragmented communication channels with centralized support ticket system."),
        spacer(),
        bullet("Ticket creation with categories (Technical, HR, Client, VA Support, General)"),
        bullet("Threaded conversation history with file attachments"),
        bullet("Auto-assign to department based on category and client"),
        bullet("Internal notes vs client-facing messages"),
        bullet("WhatsApp/email integration hooks for inbound ticket creation (future)"),
        bullet("SLA tracking and escalation (auto-escalate overdue tickets)"),
        bullet("Ticket-to-assignment linking (connect tickets to VA assignments)"),
        bullet("Real-time notifications via Supabase Realtime"),
        spacer(),

        // 9. GOOGLE DRIVE
        h1("9. Google Drive & Document Management Integration"),
        bullet("Service Account with Drive scope: https://www.googleapis.com/auth/drive.file"),
        bullet("Parent folder structure: /VAA Philippines/{Department}/{VA Name}/{Document Type}/"),
        bullet("Automatic folder creation on VA profile creation"),
        bullet("Direct file upload via API Route Handler -> Drive SDK (streamed, not buffered)"),
        bullet("2-second average upload delay (acceptable per manager discussion)"),
        bullet("Only Google Drive URLs stored in the database, never file binaries"),
        bullet("Mock implementation available for local development (lib/google/drive.ts)"),
        spacer(),

        // 10. DATA MIGRATION
        h1("10. Data Migration Strategy"),
        text("Master list from legacy Google Sheet imported in two phases:"),
        spacer(),
        h3("Phase A: Department Structure"),
        bullet("Extract unique department names from master list"),
        bullet("Map parent-child relationships based on org chart"),
        bullet("Create departments with proper hierarchy"),
        bullet("Validate against Ian's department data via WhatsApp"),
        spacer(),
        h3("Phase B: Personnel & VA Data"),
        bullet("Import user records with first_name, last_name, email"),
        bullet("Create employment records matching existing tenure data"),
        bullet("Create VA profiles with hourly rates and skills mapping"),
        bullet("Link users to departments via department_memberships"),
        bullet("Generate audit trail entries noting data migration source"),
        spacer(),
        h3("Validation"),
        bullet("Cross-reference row counts between legacy sheet and database"),
        bullet("Spot-check 10% of records for accuracy"),
        bullet("Keep legacy sheet as read-only reference for 2 weeks during transition"),
        spacer(),

        // 11. PRODUCTION DEPLOYMENT
        h1("11. Production Deployment Architecture"),
        makeTable(
          [2000, 3500, 3572],
          ["Component", "Production", "Development"],
          [
            ["Web Hosting", "Vercel Pro (Edge + Serverless)", "Vercel Hobby / localhost:3000"],
            ["Database", "Supabase PostgreSQL (managed)", "Supabase free tier / local PG"],
            ["Auth", "Supabase Auth (Google SSO)", "Supabase local / mock"],
            ["File Storage", "Google Drive API (Service Account)", "Local mock (.google-mock/)"],
            ["Cache/Queue", "Upstash Redis", "Local Redis / ioredis-mock"],
            ["Monitoring", "Grafana Cloud (Loki + Tempo)", "Console logs"],
            ["CI/CD", "GitHub Actions -> Vercel deploy", "Local dev server"],
          ],
          { leftAlign: true }
        ),
        spacer(),
        h3("Deployment Flow"),
        text("1. Push to main triggers GitHub Actions"),
        text("2. Prisma migration runs against production DB"),
        text("3. Build: next build with production optimizations"),
        text("4. Deploy to Vercel with automatic preview deployments on PR"),
        text("5. Health check: GET /api/health verifies DB and Drive API connectivity"),
        spacer(),

        // 12. MONITORING
        h1("12. Monitoring & Observability"),
        bullet("Structured logging via console (JSON format) forwarded to Grafana Loki"),
        bullet("OpenTelemetry traces for all Server Actions"),
        bullet("Supabase health metrics: connection pool, query performance, RLS policy hits"),
        bullet("Error tracking via Next.js error boundary with stack traces"),
        bullet("Performance: Vercel Analytics for Web Vitals, custom instrumentation for DB query times"),
        bullet("Alerting: Grafana alerts on error rate > 1%, p95 latency > 2s, DB pool exhaustion"),
        spacer(),

        // 13. SECURITY
        h1("13. Security & Compliance"),
        bullet("Google SSO with domain-restricted access (only @vaa.ph emails)"),
        bullet("Row-Level Security on all tables enforced at PostgreSQL level"),
        bullet("Column-level masking for financial data not visible to VA role"),
        bullet("All Google Drive files under Service Account ownership"),
        bullet("Audit trail for every CREATE/UPDATE/DELETE on critical tables (immutable)"),
        bullet("Rate limiting on login attempts and API routes via Upstash Redis"),
        bullet("HTTPS enforced via Vercel automatic SSL"),
        bullet("Environment secrets in Vercel Environment Variables (never in source)"),
        spacer(),

        // 14. ROADMAP
        h1("14. Development Roadmap"),
        makeTable(
          [1200, 2000, 3500, 2372],
          ["Phase", "Timeline", "Deliverables", "Dependencies"],
          [
            ["0 (Current)", "Complete", "Auth, Basic VA, Client, Assignment, Work Log CRUD", "None"],
            ["0.5 (Schema v2)", "Week 1", "Full schema migration plan, Prisma schema v2", "Phase 0"],
            ["1 (Departments)", "Week 1-2", "Departments, Positions, Memberships, Org Chart UI", "Schema v2"],
            ["2 (VA Workforce)", "Week 2-4", "Enhanced VA profiles, Skills v2, Employment, Leave, Documents", "Phase 1"],
            ["3 (Clients)", "Week 4-6", "Enhanced Clients, Service Lines, Skill Matching, Assignment v2", "Phase 2"],
            ["4 (Ticketing)", "Week 6-8", "Ticket system, Conversations, SLA, Notifications", "Phase 3"],
            ["5 (Polish)", "Week 8-9", "Reports, Dashboards, Loading indicators, Performance", "Phase 4"],
            ["6 (Deploy)", "Week 9-10", "Production deploy, Data migration, UAT, Go-live", "Phase 5"],
          ],
          { leftAlign: true }
        ),
        spacer(),

        // 15. ENUM REFERENCE
        h1("15. Appendix: Complete Enumerations"),
        makeTable(
          [2500, 6572],
          ["Enum Name", "Values"],
          [
            ["SystemRole", "SUPER_ADMIN|SYSTEM_ADMIN|EXECUTIVE|DEPT_MANAGER|STAFF|VA"],
            ["UserType", "INTERNAL_STAFF|VIRTUAL_ASSISTANT"],
            ["TemporaryRole", "CONTRIBUTOR|VIEWER|APPROVER"],
            ["ContractType", "REGULAR|PROJECT_BASED|PROBATIONARY"],
            ["EmploymentStatus", "EMPLOYED|ENGAGED|CONTRACTED|END_OF_CONTRACT|TRANSFERRED|RESIGNED|TERMINATED|BLACKLISTED"],
            ["Availability", "AVAILABLE|PARTIALLY_ASSIGNED|FULLY_ASSIGNED|ON_LEAVE|UNAVAILABLE"],
            ["Proficiency", "BEGINNER|INTERMEDIATE|ADVANCED|EXPERT"],
            ["LeaveType", "VACATION|SICK|EMERGENCY|MATERNITY|PATERNITY|UNPAID|BEREAVEMENT"],
            ["LeaveStatus", "PENDING|APPROVED|REJECTED|CANCELLED"],
            ["TicketCategory", "TECHNICAL|HR|CLIENT|VA_SUPPORT|GENERAL"],
            ["TicketStatus", "OPEN|IN_PROGRESS|WAITING_ON_CLIENT|RESOLVED|CLOSED"],
            ["TicketSource", "INTERNAL|EMAIL|WHATSAPP|CLIENT_PORTAL"],
            ["DocumentType", "CONTRACT|GOVERNMENT_ID|NDA|CLEARANCE|CERTIFICATE|ONBOARDING|PERFORMANCE_REVIEW|PORTFOLIO|OTHER"],
            ["AuditAction", "CREATE|UPDATE|DELETE|STATUS_CHANGE|TRANSFER|APPROVE|REJECT"],
            ["AssignmentType", "REGULAR|PROJECT"],
            ["AssignmentStatus", "ACTIVE|PAUSED|COMPLETED|CANCELLED|ON_HOLD"],
            ["SkillCategory", "STANDARD|UPSKILL|SPECIAL"],
            ["ClientPlatform", "AMAZON|WALMART|TIKTOK_SHOP|SHOPIFY|MULTI"],
            ["Priority", "LOW|MEDIUM|HIGH|URGENT"],
          ],
          { leftAlign: true }
        ),
        spacer(),
        text("- End of Document -"),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outPath = path.resolve(process.cwd(), "..", "VA-Management-System-Blueprint.docx");
fs.writeFileSync(outPath, buffer);
console.log("Created: " + outPath);
