import { prisma } from '@/lib/prisma';
import { DashboardClient } from './dashboard-client';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { shop?: string };
}) {
  const shopDomain = searchParams.shop;
  if (!shopDomain) return <div>Missing shop parameter</div>;

  const store = await prisma.store.findUnique({
    where: { shopDomain },
    include: {
      experiments: { orderBy: { startedAt: 'desc' }, take: 5 },
    },
  });

  if (!store) return <div>Store not found</div>;

  const activeExperiment = store.experiments.find(e => e.status === 'RUNNING');

  // Today's metrics
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayCartOpens = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CART_OPENED', createdAt: { gte: today } },
  });
  const todayCheckoutClicks = await prisma.event.count({
    where: { storeId: store.id, eventType: 'CHECKOUT_CLICKED', createdAt: { gte: today } },
  });

  // Per-variant stats for active experiment
  let variantStats: {
    id: string;
    label: string;
    cartOpens: number;
    checkoutClicks: number;
    rate: string;
  }[] = [];

  if (activeExperiment) {
    const variants = activeExperiment.variants as { id: string; label: string }[];
    for (const v of variants) {
      const opens = await prisma.event.count({
        where: { assignment: { experimentId: activeExperiment.id, variantId: v.id }, eventType: 'CART_OPENED' },
      });
      const clicks = await prisma.event.count({
        where: { assignment: { experimentId: activeExperiment.id, variantId: v.id }, eventType: 'CHECKOUT_CLICKED' },
      });
      variantStats.push({
        id: v.id,
        label: v.label,
        cartOpens: opens,
        checkoutClicks: clicks,
        rate: opens > 0 ? ((clicks / opens) * 100).toFixed(1) : '0.0',
      });
    }
  }

  return (
    <DashboardClient
      store={{ name: store.shopName, domain: store.shopDomain, baseline: store.baselineCheckoutRate }}
      todayMetrics={{ cartOpens: todayCartOpens, checkoutClicks: todayCheckoutClicks }}
      activeExperiment={activeExperiment ? {
        name: activeExperiment.name,
        status: activeExperiment.status,
        confidence: activeExperiment.confidence,
        liftPercent: activeExperiment.liftPercent,
        trafficSplit: activeExperiment.trafficSplit as Record<string, number>,
        startedAt: activeExperiment.startedAt.toISOString(),
        variants: variantStats,
      } : null}
      completedExperiments={store.experiments
        .filter(e => e.status !== 'RUNNING')
        .map(e => ({
          name: e.name,
          status: e.status,
          confidence: e.confidence,
          liftPercent: e.liftPercent,
          winnerVariantId: e.winnerVariantId,
          startedAt: e.startedAt.toISOString(),
          endedAt: e.endedAt?.toISOString(),
        }))}
    />
  );
}
