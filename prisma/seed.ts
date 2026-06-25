import { PrismaClient } from "@/src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
  }),
})

async function main() {
  console.log("Seeding database...")

  const manager = await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      name: "Alice Manager",
      role: "MANAGER",
      department: "Editorial",
    },
  })

  await prisma.user.upsert({
    where: { email: "va1@example.com" },
    update: {},
    create: {
      email: "va1@example.com",
      name: "Bob Assistant",
      role: "VA",
      department: "Editorial",
      vaProfile: {
        create: {
          phone: "+1-555-0101",
          hourlyRate: 25.0,
          notes: "Specializes in content writing",
        },
      },
    },
  })

  await prisma.user.upsert({
    where: { email: "va2@example.com" },
    update: {},
    create: {
      email: "va2@example.com",
      name: "Carol Helper",
      role: "VA",
      department: "Editorial",
      vaProfile: {
        create: {
          phone: "+1-555-0102",
          hourlyRate: 30.0,
          notes: "Expert in research and data entry",
        },
      },
    },
  })

  await prisma.user.upsert({
    where: { email: "va3@example.com" },
    update: {},
    create: {
      email: "va3@example.com",
      name: "Dave Support",
      role: "VA",
      department: "Social Media",
      vaProfile: {
        create: {
          phone: "+1-555-0103",
          hourlyRate: 20.0,
          notes: "Social media management",
        },
      },
    },
  })

  const vaProfiles = await prisma.vAProfile.findMany({
    include: { user: true },
  })

  const sampleTasks = [
    {
      title: "Draft weekly newsletter",
      description: "Write and format the weekly newsletter for subscribers.",
      priority: "HIGH" as const,
      status: "IN_PROGRESS" as const,
      dueDate: new Date("2026-07-01"),
    },
    {
      title: "Research competitor blogs",
      description: "Compile a list of top 10 competitor blogs with key takeaways.",
      priority: "MEDIUM" as const,
      status: "TODO" as const,
      dueDate: new Date("2026-06-28"),
    },
    {
      title: "Update social media calendar",
      description: "Plan and schedule posts for next month across all platforms.",
      priority: "LOW" as const,
      status: "BACKLOG" as const,
      dueDate: null,
    },
    {
      title: "Proofread Q3 report",
      description: "Review grammar, consistency, and formatting.",
      priority: "URGENT" as const,
      status: "REVIEW" as const,
      dueDate: new Date("2026-06-26"),
    },
    {
      title: "Organize Drive files",
      description: "Clean up and restructure the shared Google Drive folder.",
      priority: "LOW" as const,
      status: "DONE" as const,
      dueDate: new Date("2026-06-20"),
    },
  ]

  for (const [index, task] of sampleTasks.entries()) {
    const vaProfile = vaProfiles[index % vaProfiles.length]
    await prisma.task.create({
      data: {
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
        dueDate: task.dueDate,
        department: vaProfile.user.department ?? null,
        assignedToId: vaProfile.id,
        assignedById: manager.id,
      },
    })
  }

  console.log("Seed completed.")
  console.log(`  Manager: manager@example.com`)
  console.log(`  VAs: va1@example.com, va2@example.com, va3@example.com`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
