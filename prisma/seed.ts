import "dotenv/config"
import * as dotenv from "dotenv"
dotenv.config({ path: ".env.local" })

import { PrismaClient } from "@/src/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
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
      department: "Operations",
    },
  })

  const va1 = await prisma.user.upsert({
    where: { email: "va1@example.com" },
    update: {},
    create: {
      email: "va1@example.com",
      name: "Bob Santos",
      role: "VA",
      department: "Amazon Operations",
      vaProfile: {
        create: {
          phone: "+63-917-555-0101",
          hourlyRate: 8.0,
          notes: "Amazon Expert - trained in Seller Central operations",
        },
      },
    },
    include: { vaProfile: true },
  })

  const va2 = await prisma.user.upsert({
    where: { email: "va2@example.com" },
    update: {},
    create: {
      email: "va2@example.com",
      name: "Carol Reyes",
      role: "VA",
      department: "PPC & Shopify",
      vaProfile: {
        create: {
          phone: "+63-917-555-0102",
          hourlyRate: 12.0,
          notes: "Amazon PPC + Shopify specialist",
        },
      },
    },
    include: { vaProfile: true },
  })

  const va3 = await prisma.user.upsert({
    where: { email: "va3@example.com" },
    update: {},
    create: {
      email: "va3@example.com",
      name: "Dave Cruz",
      role: "VA",
      department: "Walmart",
      vaProfile: {
        create: {
          phone: "+63-917-555-0103",
          hourlyRate: 10.0,
          notes: "Walmart Marketplace VA - PPC + Social Media",
        },
      },
    },
    include: { vaProfile: true },
  })

  const skillCatalog: { name: string; category: "AMAZON" | "WALMART" | "TIKTOK_SHOP" | "SHOPIFY" | "GENERAL" }[] = [
    { name: "TikTok Shop Virtual Assistant", category: "TIKTOK_SHOP" },
    { name: "Shopify Virtual Assistant", category: "SHOPIFY" },
    { name: "Customer Service", category: "GENERAL" },
    { name: "Amazon Expert", category: "AMAZON" },
    { name: "Amazon PPC Specialist", category: "AMAZON" },
    { name: "Social Media Specialist", category: "GENERAL" },
    { name: "Creative Expert", category: "GENERAL" },
    { name: "Virtual Executive Assistant", category: "GENERAL" },
    { name: "Wholesale Expert", category: "AMAZON" },
    { name: "Walmart Virtual Assistant", category: "WALMART" },
    { name: "Walmart PPC Specialist", category: "WALMART" },
  ]

  const skills = await Promise.all(
    skillCatalog.map(({ name, category }) =>
      prisma.skill.upsert({
        where: { name },
        update: { category },
        create: { name, category },
      })
    )
  )

  const findSkill = (n: string) => skills.find((s) => s.name === n)!

  await prisma.vAProfile.update({
    where: { id: va1.vaProfile!.id },
    data: {
      skills: {
        connect: [
          { id: findSkill("Amazon Expert").id },
          { id: findSkill("Customer Service").id },
          { id: findSkill("Wholesale Expert").id },
        ],
      },
    },
  })
  await prisma.vAProfile.update({
    where: { id: va2.vaProfile!.id },
    data: {
      skills: {
        connect: [
          { id: findSkill("Amazon PPC Specialist").id },
          { id: findSkill("Shopify Virtual Assistant").id },
        ],
      },
    },
  })
  await prisma.vAProfile.update({
    where: { id: va3.vaProfile!.id },
    data: {
      skills: {
        connect: [
          { id: findSkill("Walmart Virtual Assistant").id },
          { id: findSkill("Walmart PPC Specialist").id },
          { id: findSkill("Social Media Specialist").id },
        ],
      },
    },
  })

  const client1 = await prisma.client.upsert({
    where: { id: "seed-client-1" },
    update: {},
    create: {
      id: "seed-client-1",
      name: "NorthStar Brands",
      contactName: "Craig Leslie",
      contactEmail: "craig@northstarbrands.com",
      platform: "AMAZON",
      industry: "Amazon Seller",
      requiredSkills: ["Amazon Expert", "Customer Service"],
      managerId: manager.id,
      notes: "Amazon brand - ongoing support",
    },
  })

  const client2 = await prisma.client.upsert({
    where: { id: "seed-client-2" },
    update: {},
    create: {
      id: "seed-client-2",
      name: "BrightCart Shopify",
      contactName: "Sara Lee",
      contactEmail: "sara@brightcart.com",
      platform: "SHOPIFY",
      industry: "DTC eCommerce",
      requiredSkills: ["Shopify Virtual Assistant", "Amazon PPC Specialist"],
      managerId: manager.id,
      notes: "Shopify store + Amazon PPC",
    },
  })

  const client3 = await prisma.client.upsert({
    where: { id: "seed-client-3" },
    update: {},
    create: {
      id: "seed-client-3",
      name: "PeakValue Marketplace",
      contactName: "Mike Reyes",
      contactEmail: "mike@peakvalue.com",
      platform: "WALMART",
      industry: "Walmart Marketplace",
      requiredSkills: ["Walmart Virtual Assistant", "Walmart PPC Specialist"],
      managerId: manager.id,
      notes: "Q3 Walmart expansion project",
    },
  })

  const assignment1 = await prisma.assignment.upsert({
    where: { id: "seed-asgn-1" },
    update: {},
    create: {
      id: "seed-asgn-1",
      type: "REGULAR",
      status: "ACTIVE",
      agreedHours: 40,
      monthlyHours: 40,
      startDate: new Date("2026-01-01"),
      vaProfileId: va1.vaProfile!.id,
      clientId: client1.id,
      notes: "Ongoing monthly retainer",
    },
  })

  const assignment2 = await prisma.assignment.upsert({
    where: { id: "seed-asgn-2" },
    update: {},
    create: {
      id: "seed-asgn-2",
      type: "REGULAR",
      status: "ACTIVE",
      agreedHours: 30,
      monthlyHours: 30,
      startDate: new Date("2026-02-15"),
      vaProfileId: va2.vaProfile!.id,
      clientId: client2.id,
      notes: "Weekly product data",
    },
  })

  const assignment3 = await prisma.assignment.upsert({
    where: { id: "seed-asgn-3" },
    update: {},
    create: {
      id: "seed-asgn-3",
      type: "PROJECT",
      status: "ACTIVE",
      agreedHours: 60,
      startDate: new Date("2026-06-01"),
      endDate: new Date("2026-08-31"),
      vaProfileId: va3.vaProfile!.id,
      clientId: client3.id,
      notes: "Q3 brand campaign - fixed scope",
    },
  })

  const today = new Date()
  const workLogSamples = [
    { assignmentId: assignment1.id, vaProfileId: va1.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 2), hours: 8, description: "Drafted June newsletter" },
    { assignmentId: assignment1.id, vaProfileId: va1.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 3), hours: 6, description: "Edited articles for SEO" },
    { assignmentId: assignment1.id, vaProfileId: va1.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 5), hours: 7, description: "Final newsletter review" },
    { assignmentId: assignment2.id, vaProfileId: va2.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 2), hours: 5, description: "Listed 50 SKUs" },
    { assignmentId: assignment2.id, vaProfileId: va2.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 4), hours: 6, description: "Updated inventory" },
    { assignmentId: assignment3.id, vaProfileId: va3.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 1), hours: 4, description: "Brand moodboard" },
    { assignmentId: assignment3.id, vaProfileId: va3.vaProfile!.id, workDate: new Date(today.getFullYear(), today.getMonth(), 3), hours: 6, description: "Instagram post set" },
  ]

  for (const log of workLogSamples) {
    await prisma.workLog.create({ data: log })
  }

  console.log("Seed completed.")
  console.log(`  Manager: manager@example.com`)
  console.log(`  VAs: va1@example.com, va2@example.com, va3@example.com`)
  console.log(`  Clients: ${client1.name}, ${client2.name}, ${client3.name}`)
  console.log(`  ${workLogSamples.length} work logs created for the current month`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })