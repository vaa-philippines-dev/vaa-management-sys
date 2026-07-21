import { defineConfig } from "prisma/config"
import * as dotenv from "dotenv"

dotenv.config({ path: ".env.local" })

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Migrations need a direct (non-pooled) connection — PgBouncer's transaction
    // pooling mode doesn't support the session-level advisory locks the migration
    // engine uses, which makes `migrate dev`/`migrate status` hang indefinitely
    // against DATABASE_URL. The app's runtime client (lib/prisma.ts) is separate
    // and keeps using the pooled DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
})
