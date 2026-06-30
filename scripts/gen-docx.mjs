import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, AlignmentType, WidthType, ShadingType,
  TableLayoutType, BorderStyle,
} from "docx";
import fs from "fs";

const BLUE = "1F4E79";
const DARK = "333333";
const WHITE = "FFFFFF";
const FULL = 9072;

const border = {
  style: BorderStyle.SINGLE,
  size: 1,
  color: "CCCCCC",
};

const cellBorders = {
  top: border, bottom: border, left: border, right: border,
};

const h1 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 32, color: BLUE })],
    spacing: { before: 400, after: 200 },
  });

const h3 = (text) =>
  new Paragraph({
    children: [new TextRun({ text, bold: true, size: 22, color: DARK })],
    spacing: { before: 200, after: 100 },
  });

const text = (t) =>
  new Paragraph({
    children: [new TextRun({ text: t, size: 20, color: DARK })],
    spacing: { after: 100 },
  });

const boldText = (label, value) =>
  new Paragraph({
    children: [
      new TextRun({ text: label, bold: true, size: 20, color: DARK }),
      new TextRun({ text: value, size: 20, color: DARK }),
    ],
    spacing: { after: 60 },
  });

const spacer = () => new Paragraph({ spacing: { after: 100 }, children: [] });

function makeTable(colWidths, headerTexts, rows) {
  const total = colWidths.reduce((a, b) => a + b, 0);
  const pct = (w) => Math.round((w / total) * FULL);

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

  const dataRows = rows.map((r) =>
    new TableRow({
      children: r.map((c, i) => {
        const isLastRow = rows.indexOf(r) === rows.length - 1;
        const isTotal = c.startsWith("$") && rows.indexOf(r) >= rows.length - 2;
        return new TableCell({
          width: { size: pct(colWidths[i]), type: WidthType.DXA },
          borders: cellBorders,
          shading: isTotal ? { type: ShadingType.SOLID, color: "F2F2F2" } : undefined,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 30, after: 30 },
              children: [
                new TextRun({
                  text: c,
                  size: 18,
                  color: DARK,
                  bold: isTotal,
                }),
              ],
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
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "VA Management Platform", bold: true, size: 36, color: BLUE })],
          spacing: { after: 60 },
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: "Infrastructure Cost Proposal & Architecture Overview", size: 24, color: DARK })],
          spacing: { after: 200 },
        }),
        text("Prepared for: Operations Management"),
        text("Prepared by: Development Team"),
        text("Date: June 26, 2026"),
        spacer(),

        h1("1. Executive Summary"),
        text("The VAA Philippines VA Management System is being upgraded from a basic prototype to a production-grade platform capable of scaling from 3 VAs to 700+ VAs. This proposal outlines the infrastructure cost at each growth phase and compares fully-managed vs. self-hosted strategies."),
        text("Key takeaway: Starting costs are minimal ($57/mo at 50 VAs). The architecture is designed so you can start fully managed and seamlessly transition to self-hosted as you exceed 200 VAs, without rewriting any code."),
        spacer(),

        h1("2. Monthly Cost Comparison by VA Tier"),
        makeTable(
          [2800, 1400, 1400, 1400],
          ["Category", "50 VAs", "200 VAs", "700 VAs"],
          [
            ["PostgreSQL + Auth", "$25", "$150", "$600"],
            ["Web Hosting (Vercel)", "$20", "$20", "$20"],
            ["Redis Stream (queue)", "$5", "$12", "$25"],
            ["Go Workers (ingestion)", "$5", "$15", "$25"],
            ["Object Storage (screenshots)", "$1.50", "$5", "$15"],
            ["Observability", "$0", "$50", "$150"],
            ["Fully Managed Total", "$56.50", "$252", "$835"],
            ["Self-Hosted Total", "$56.50", "$155", "$155"],
          ]
        ),
        spacer(),
        text("New infrastructure cost to serve 50 VAs is only $11.50/mo on top of current spend."),
        spacer(),

        h1("3. At 700 VAs: Fully Managed vs. Self-Hosted"),
        h3("700 VA monthly data volume:"),
        text("\u2022 Time ticks: 6 million per day (every 10 seconds per VA)"),
        text("\u2022 Database rows: 132 million per month"),
        text("\u2022 Screenshots: 201,600 per day = ~880 GB per month"),
        text("\u2022 PostgreSQL storage: ~500 GB after 3 months"),
        spacer(),
        h3("Side-by-Side Comparison"),
        makeTable(
          [1800, 2600, 2600, 1400],
          ["Resource", "Fully Managed", "Self-Hosted Hybrid", "Monthly Savings"],
          [
            ["PostgreSQL", "Supabase Team - $599/mo", "Hetzner CX62 (8vCPU, 32GB) - $80/mo", "$519"],
            ["Web Hosting", "Vercel Pro - $20/mo", "Vercel Pro - $20/mo", "$0"],
            ["Redis", "Upstash 4GB - $25/mo", "Self-hosted on DB VPS - $0", "$25"],
            ["Workers", "Railway 4 instances - $25/mo", "Hetzner CX42 (4vCPU, 8GB) - $40/mo", "-$15"],
            ["Screenshots", "Cloudflare R2 - $15/mo", "Cloudflare R2 - $15/mo", "$0"],
            ["Logs + Traces", "Grafana Cloud Pro - $150/mo", "Self-hosted on VPS - $0", "$150"],
            ["Total Monthly", "$834/mo", "$155/mo", "-$679/mo"],
            ["Total Yearly", "$10,008/yr", "$1,860/yr", "-$8,148/yr"],
          ]
        ),
        spacer(),
        h3("Self-Hosted Hardware Specs"),
        boldText("VPS 1 - Database Server ", "(Hetzner CX62) - $80/mo"),
        text("\u2022 8 vCPU (AMD EPYC), 32 GB RAM, 500 GB NVMe SSD, 20 TB traffic"),
        text("\u2022 Runs: PostgreSQL 16 + Redis + Grafana stack"),
        spacer(),
        boldText("VPS 2 - Worker Server ", "(Hetzner CX42) - $40/mo"),
        text("\u2022 4 vCPU (AMD EPYC), 8 GB RAM, 80 GB NVMe SSD, 20 TB traffic"),
        text("\u2022 Runs: Go ingestion workers + OpenTelemetry collector"),
        spacer(),
        text("Total infrastructure: $120/mo + $35/mo (R2 + Vercel) = $155/mo"),
        spacer(),

        h1("4. Yearly Cost Projection"),
        makeTable(
          [2000, 2800, 2800, 1400],
          ["VA Tier", "Fully Managed (Annual)", "Self-Hosted (Annual)", "Savings"],
          [
            ["50", "$678", "$678", "$0"],
            ["200", "$3,024", "$1,860", "$1,164"],
            ["700", "$10,008", "$1,860", "$8,148"],
          ]
        ),
        spacer(),
        text("At 700 VAs, self-hosting saves $8,148 per year - enough to cover a part-time DevOps contractor for monitoring."),
        spacer(),

        h1("5. Technology Stack"),
        makeTable(
          [1400, 2200, 5400],
          ["Layer", "Technology", "Why"],
          [
            ["Workers", "Go", "Sub-ms latency, native concurrency for high-throughput ingestion"],
            ["Web App", "Next.js 16 + TypeScript", "Already built on this stack"],
            ["Database", "PostgreSQL 16 + partitioning", "Relational integrity, JSONB for audit, Row-Level Security"],
            ["Queue", "Redis 7 Streams", "Single tool for queue + cache. No Kafka needed at 6M msg/day"],
            ["Object Storage", "Cloudflare R2", "Zero egress fees vs AWS S3 ($90/TB). Saves $79/mo at 700 VAs"],
            ["Auth", "Supabase Auth + custom RBAC", "Google SSO already integrated"],
            ["Observability", "OpenTelemetry -> Grafana", "Correlation-ID tracing across all services"],
          ]
        ),
        spacer(),
        h3("Why NOT these alternatives"),
        text("\u2022 AWS S3 for screenshots: $90/TB egress at 700 VAs - R2 is $0/TB"),
        text("\u2022 RabbitMQ / Kafka: Overkill for 6M msg/day. Redis Streams handles this"),
        text("\u2022 Celery (Python workers): Python GIL limits throughput vs Go"),
        text("\u2022 AWS RDS Aurora: 3-4x more expensive than Hetzner VPS for same performance"),
        spacer(),

        h1("6. Database Growth Projection"),
        makeTable(
          [1200, 1400, 1400, 1800, 1800, 1400],
          ["VA Count", "Ticks/Day", "Ticks/Month", "DB Storage (3mo)", "Screenshots/Month", "R2 Storage (3mo)"],
          [
            ["50", "432,000", "9.5M", "~35 GB", "14,400", "~25 GB"],
            ["200", "1.7M", "38M", "~140 GB", "57,600", "~100 GB"],
            ["700", "6M", "132M", "~500 GB", "201,600", "~880 GB"],
          ]
        ),
        spacer(),

        h1("7. Phased Rollout Plan"),
        makeTable(
          [1200, 1200, 3400, 1400, 1800],
          ["Phase", "VAs", "Stack", "Monthly Cost", "Timeline"],
          [
            ["Now", "3", "Current (Supabase + Vercel)", "$45", "Already running"],
            ["1", "\u226450", "Add Redis + Workers + R2", "~$57", "Week 1-2"],
            ["2", "50-200", "Upgrade Supabase to Scale", "~$252", "Month 1-2"],
            ["3", "200+", "Migrate to self-hosted PG", "~$155", "Month 3+"],
          ]
        ),
        spacer(),
        text("The migration from Supabase to self-hosted requires zero code changes. Prisma abstracts the database connection. It is a one-evening operation: pg_dump from Supabase, psql restore to Hetzner VPS, update DATABASE_URL env var, deploy."),
        spacer(),

        h1("8. One-Time Development Costs"),
        makeTable(
          [2200, 1200, 5600],
          ["Component", "Effort", "Description"],
          [
            ["Go ingestion worker", "16 hrs", "Redis Streams to PostgreSQL batch insert"],
            ["Tracker client (IndexedDB + presigned URLs)", "8 hrs", "Browser extension or Electron app"],
            ["Audit triggers + RLS policies", "4 hrs", "SQL triggers and row-level security"],
            ["RBAC middleware extension", "4 hrs", "Route guards + financial column masking"],
            ["Total", "32 hrs (one sprint)", ""],
          ]
        ),
        spacer(),

        h1("9. Key Risks & Mitigations"),
        makeTable(
          [1700, 2200, 5100],
          ["Risk", "Impact", "Mitigation"],
          [
            ["PostgreSQL slow at 100M+ rows/mo", "Queries take minutes", "Monthly partitioning + composite indexes on (va_profile_id, recorded_at)"],
            ["Redis data loss on crash", "Lose up to 5 seconds of ticks", "AOF persistence + client-side IndexedDB replay"],
            ["Worker crash mid-batch", "Duplicate rows", "Dedup via client_batch_id in Redis TTL set"],
            ["Philippines ISP outages", "Lost time tracking", "IndexedDB local queue with sync protocol on reconnect"],
            ["Vercel cold starts on API", "500ms latency on tick ingestion", "Edge functions for POST /api/ticks (<50ms)"],
            ["Manager sees billing data", "Policy violation", "PostgreSQL column-level VIEW masking at DB level"],
          ]
        ),
        spacer(),
      ],
    },
  ],
});

const buffer = await Packer.toBuffer(doc);
const outPath = "F:\\VAA Philippines\\VA-Management-Cost-Proposal.docx";
fs.writeFileSync(outPath, buffer);
console.log("Created: " + outPath);
