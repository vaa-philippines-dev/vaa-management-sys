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

  await prisma.user.upsert({
    where: { email: "manager@example.com" },
    update: {},
    create: {
      email: "manager@example.com",
      firstName: "Alice",
      lastName: "Manager",
      systemRole: "DEPT_MANAGER",
      userType: "INTERNAL_STAFF",
    },
  })

  const va1 = await prisma.user.upsert({
    where: { email: "va1@example.com" },
    update: {},
    create: {
      email: "va1@example.com",
      firstName: "Bob",
      lastName: "Santos",
      systemRole: "VA",
      userType: "VIRTUAL_ASSISTANT",
      vaProfile: {
        create: {
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
      firstName: "Carol",
      lastName: "Reyes",
      systemRole: "VA",
      userType: "VIRTUAL_ASSISTANT",
      vaProfile: {
        create: {
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
      firstName: "Dave",
      lastName: "Cruz",
      systemRole: "VA",
      userType: "VIRTUAL_ASSISTANT",
      vaProfile: {
        create: {
          hourlyRate: 10.0,
          notes: "Walmart Marketplace VA - PPC + Social Media",
        },
      },
    },
    include: { vaProfile: true },
  })

  const skillCatalog: { name: string; category: "STANDARD" | "UPSKILL" | "SPECIAL" }[] = [
    { name: "TikTok Shop Virtual Assistant", category: "STANDARD" },
    { name: "Shopify Virtual Assistant", category: "STANDARD" },
    { name: "Customer Service", category: "STANDARD" },
    { name: "Amazon Expert", category: "STANDARD" },
    { name: "Amazon PPC Specialist", category: "UPSKILL" },
    { name: "Social Media Specialist", category: "STANDARD" },
    { name: "Creative Expert", category: "STANDARD" },
    { name: "Virtual Executive Assistant", category: "STANDARD" },
    { name: "Wholesale Expert", category: "UPSKILL" },
    { name: "Walmart Virtual Assistant", category: "STANDARD" },
    { name: "Walmart PPC Specialist", category: "UPSKILL" },
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
      vaSkills: {
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
      vaSkills: {
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
      vaSkills: {
        connect: [
          { id: findSkill("Walmart Virtual Assistant").id },
          { id: findSkill("Walmart PPC Specialist").id },
          { id: findSkill("Social Media Specialist").id },
        ],
      },
    },
  })

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