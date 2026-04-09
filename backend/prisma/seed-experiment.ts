import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const shopDomain = process.argv[2];
  if (!shopDomain) {
    console.error('Usage: npx ts-node prisma/seed-experiment.ts <shop-domain>');
    process.exit(1);
  }

  const store = await prisma.store.findUnique({ where: { shopDomain } });
  if (!store) {
    console.error(`Store ${shopDomain} not found. Run OAuth install first.`);
    process.exit(1);
  }

  // Check if experiment already exists
  const existing = await prisma.experiment.findFirst({
    where: { storeId: store.id, slot: 'below_checkout' },
  });
  if (existing) {
    console.log('Experiment already exists:', existing.id, existing.status);
    return;
  }

  const experiment = await prisma.experiment.create({
    data: {
      storeId: store.id,
      name: 'Trust Badges Below Checkout',
      slot: 'below_checkout',
      status: 'RUNNING',
      variants: [
        {
          id: 'control',
          label: 'No badges',
          features: { showTrustBadges: false },
        },
        {
          id: 'trust_badges',
          label: 'Payment icons + Secure text',
          features: { showTrustBadges: true },
        },
      ],
      trafficSplit: { control: 0.5, trust_badges: 0.5 },
      maxDays: 14,
    },
  });

  console.log('Created experiment:', experiment.id, experiment.name);
}

main().catch(console.error).finally(() => prisma.$disconnect());
