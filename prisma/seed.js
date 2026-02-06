/* eslint-disable no-console */

const { PrismaClient, UserRole, ClientStatus, BillingCycleStartDay } = require("@prisma/client");

const prisma = new PrismaClient();

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

  // Create at least one Client so worklog submissions can reference a clientId.
  // Client.name is not unique, so we only create one if there are no clients yet.
  const existingClient = await prisma.client.findFirst({
    orderBy: { createdAt: "asc" },
  });

  const client =
    existingClient ??
    (await prisma.client.create({
      data: {
        name: "Seed Client",
        status: ClientStatus.ACTIVE,
        billingCycleStartDay: BillingCycleStartDay.FIRST,
        monthlyRetainerHours: 0,
        clientBillingEmail: adminEmail,
      },
    }));

  console.log("Seed complete:");
  console.log(`- admin user: ${adminUser.email} (${adminUser.id}) role=${adminUser.role}`);
  console.log(`- client: ${client.name} (${client.id})`);
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
