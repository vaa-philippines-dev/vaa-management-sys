import type { Prisma } from '@/src/generated/prisma/client'

/**
 * Generates the next "VA-<YY>-<seq>" employee ID for a given hire year,
 * atomically incrementing a per-year counter row so concurrent VA creation
 * can't hand out duplicate IDs. Must run inside the same transaction as the
 * User write that consumes the returned ID.
 */
export async function generateEmployeeId(
  tx: Prisma.TransactionClient,
  hireDate: Date
): Promise<string> {
  const year = hireDate.getFullYear()

  const [row] = await tx.$queryRaw<{ last_seq: number }[]>`
    INSERT INTO "employee_id_counters" ("year", "last_seq")
    VALUES (${year}, 1)
    ON CONFLICT ("year") DO UPDATE SET "last_seq" = "employee_id_counters"."last_seq" + 1
    RETURNING "last_seq"
  `

  const year2 = String(year).slice(-2)
  const seq = String(row.last_seq).padStart(4, '0')
  return `VA-${year2}-${seq}`
}
