/* eslint-disable no-console */

const { PrismaClient, UserRole, ClientStatus, BillingCycleStartDay } = require("@prisma/client");

// Prefer DIRECT_URL for seed/migrations (Neon pooled URLs often run through PgBouncer).
// Prisma seed can run more reliably against a direct (non-pooled) connection.
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DIRECT_URL || process.env.DATABASE_URL,
    },
  },
});

async function main() {
  const adminEmailRaw = process.env.ADMIN_SEED_EMAIL;
  if (!adminEmailRaw) {
    throw new Error(
      "Missing ADMIN_SEED_EMAIL env var (the seed script uses this to upsert the initial ADMIN user)."
    );
  }

  const adminEmail = String(adminEmailRaw).trim().toLowerCase();
  if (!adminEmail.includes("@")) {
    throw new Error(`ADMIN_SEED_EMAIL doesn't look like an email: ${adminEmailRaw}`);
  }

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: UserRole.ADMIN },
    create: {
      email: adminEmail,
      role: UserRole.ADMIN,
      name: "Seed Admin",
    },
  });

  // Create example Clients so worklog submissions can reference a clientId.
  // Client.name is not unique; to keep this idempotent without adding new schema constraints,
  // we only create the examples when the DB has *zero* clients.
  const clientCount = await prisma.client.count();

  let exampleClients = [];

  if (clientCount === 0) {
    const toCreate = [
      {
        name: "Client A",
        status: ClientStatus.ACTIVE,
        billingCycleStartDay: BillingCycleStartDay.FIRST,
        monthlyRetainerHours: 10,
        clientBillingEmail: adminEmail,
      },
      {
        name: "Client B",
        status: ClientStatus.ACTIVE,
        billingCycleStartDay: BillingCycleStartDay.FIFTEENTH,
        monthlyRetainerHours: 5,
        clientBillingEmail: adminEmail,
      },
      {
        name: "Client C",
        status: ClientStatus.ON_HOLD,
        billingCycleStartDay: BillingCycleStartDay.FIRST,
        monthlyRetainerHours: 0,
        clientBillingEmail: adminEmail,
      },
    ];

    await prisma.client.createMany({ data: toCreate });

    exampleClients = await prisma.client.findMany({
      where: { name: { in: toCreate.map((c) => c.name) } },
      orderBy: { createdAt: "asc" },
    });
  }

  // Always pick a stable “default” client to print (and for humans to copy/paste).
  const firstClient = await prisma.client.findFirst({ orderBy: { createdAt: "asc" } });

  console.log("Seed complete:");
  console.log(`- admin user: ${adminUser.email} (${adminUser.id}) role=${adminUser.role}`);
  if (exampleClients.length > 0) {
    console.log(`- created ${exampleClients.length} example clients:`);
    for (const c of exampleClients) {
      console.log(`  - ${c.name} (${c.id}) status=${c.status} billingStart=${c.billingCycleStartDay}`);
    }
  } else {
    console.log(`- clients already present (count=${clientCount}); no example clients created`);
  }
  if (firstClient) {
    console.log(`- first client: ${firstClient.name} (${firstClient.id})`);
  }
}

main()
  .catch((err) => {
    console.error("Seed failed:");
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
