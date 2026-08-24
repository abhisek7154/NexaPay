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

const demoUsers = [
  {
    name: "Abhishek",
    email: "abhishek@nexapay.demo",
    upiId: "abhishek@nexapay",
    balance: 5000,
    isActive: true,
  },
  {
    name: "Rahul",
    email: "rahul@nexapay.demo",
    upiId: "rahul@nexapay",
    balance: 5000,
    isActive: true,
  },
] as const;

const paymentMethods = [
  {
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
    priority: 1,
  },
  {
    code: "CARD",
    name: "Card Payment",
    category: "CARD",
    isActive: true,
    minAmount: 1,
    maxAmount: 100000,
    requiresAuth: false,
    settlementDays: 1,
    feePercent: 2,
    feeFlat: 0,
    priority: 2,
  },
] as const;

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

  const seededPaymentMethods = [];

  for (const paymentMethodConfig of paymentMethods) {
    const paymentMethod = await prisma.paymentMethod.upsert({
      where: {
        code: paymentMethodConfig.code,
      },
      update: {
        name: paymentMethodConfig.name,
        category: paymentMethodConfig.category,
        isActive: paymentMethodConfig.isActive,
        minAmount: paymentMethodConfig.minAmount,
        maxAmount: paymentMethodConfig.maxAmount,
        requiresAuth: paymentMethodConfig.requiresAuth,
        settlementDays: paymentMethodConfig.settlementDays,
        feePercent: paymentMethodConfig.feePercent,
        feeFlat: paymentMethodConfig.feeFlat,
      },
      create: {
        code: paymentMethodConfig.code,
        name: paymentMethodConfig.name,
        category: paymentMethodConfig.category,
        isActive: paymentMethodConfig.isActive,
        minAmount: paymentMethodConfig.minAmount,
        maxAmount: paymentMethodConfig.maxAmount,
        requiresAuth: paymentMethodConfig.requiresAuth,
        settlementDays: paymentMethodConfig.settlementDays,
        feePercent: paymentMethodConfig.feePercent,
        feeFlat: paymentMethodConfig.feeFlat,
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
        priority: paymentMethodConfig.priority,
        settlementPriority: paymentMethodConfig.priority,
      },
      create: {
        merchantId: merchant.id,
        paymentMethodId: paymentMethod.id,
        isActive: true,
        priority: paymentMethodConfig.priority,
        settlementPriority: paymentMethodConfig.priority,
      },
    });

    seededPaymentMethods.push({
      id: paymentMethod.id,
      code: paymentMethod.code,
      isActive: paymentMethod.isActive,
    });
  }

  const seededUsers = [];

  for (const demoUser of demoUsers) {
    const user = await prisma.user.upsert({
      where: {
        upiId: demoUser.upiId,
      },
      update: {
        name: demoUser.name,
        email: demoUser.email,
        isActive: demoUser.isActive,
      },
      create: {
        name: demoUser.name,
        email: demoUser.email,
        upiId: demoUser.upiId,
        isActive: demoUser.isActive,
      },
    });

    const wallet = await prisma.wallet.upsert({
      where: {
        userId: user.id,
      },
      update: {
        balance: demoUser.balance,
      },
      create: {
        userId: user.id,
        balance: demoUser.balance,
      },
    });

    seededUsers.push({
      name: user.name,
      email: user.email,
      upiId: user.upiId,
      balance: wallet.balance,
      isActive: user.isActive,
    });
  }

  console.log("✅ Seed successful!");
  console.log("Merchant ID:", merchant.id);
  console.log("Payment Methods:", seededPaymentMethods);
  console.log("Demo Users:", seededUsers);
}

main()
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
