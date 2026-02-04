import { PrismaClient } from "@/generated/prisma";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma v7+ gets datasource via prisma.config.ts
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
