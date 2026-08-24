import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not defined");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  console.log("🌱 Seeding Neon database...");

  const merchant = await prisma.merchant.upsert({
    where: {
      apiKey: "test_api_key",
    },
    update: {},
    create: {
      name: "Test Merchant",
      apiKey: "test_api_key",
      onboardingStatus: "COMPLETED",
      kycStatus: "VERIFIED",
      perTransactionLimit: 100000,
      dailyLimit: 1000000,
      monthlyLimit: 10000000,
    },
  });

  const paymentMethod = await prisma.paymentMethod.upsert({
    where: {
      code: "UPI",
    },
    update: {},
    create: {
      code: "UPI",
      name: "Unified Payments Interface",
      category: "BANK_TRANSFER",
      isActive: true,
      minAmount: 1,
      maxAmount: 100000,
      requiresAuth: false,
      settlementDays: 1,
      feePercent: 1.5,
      feeFlat: 0,
    },
  });

  await prisma.merchantPaymentMethod.upsert({
    where: {
      merchantId_paymentMethodId: {
        merchantId: merchant.id,
        paymentMethodId: paymentMethod.id,
      },
    },
    update: {
      isActive: true,
    },
    create: {
      merchantId: merchant.id,
      paymentMethodId: paymentMethod.id,
      isActive: true,
      priority: 1,
      settlementPriority: 1,
    },
  });

  console.log("✅ Seed successful!");
  console.log("Merchant ID:", merchant.id);
  console.log("Payment Method ID:", paymentMethod.id);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });