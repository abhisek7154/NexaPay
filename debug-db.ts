import { PrismaClient } from './src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined');
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    include: { wallet: true },
    orderBy: { name: 'asc' },
  });

  console.log(JSON.stringify(users.map((u) => ({
    id: u.id,
    name: u.name,
    upiId: u.upiId,
    isActive: u.isActive,
    balance: u.wallet?.balance,
  })), null, 2));

  const methods = await prisma.paymentMethod.findMany({
    orderBy: { code: 'asc' },
  });

  console.log(JSON.stringify(methods.map((m) => ({
    code: m.code,
    isActive: m.isActive,
  })), null, 2));

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
