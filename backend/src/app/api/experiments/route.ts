import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/experiments?storeId=xxx — list experiments
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId');
  if (!storeId) {
    return NextResponse.json({ error: 'Missing storeId' }, { status: 400 });
  }

  const experiments = await prisma.experiment.findMany({
    where: { storeId },
    orderBy: { startedAt: 'desc' },
    include: {
      _count: { select: { assignments: true } },
    },
  });

  // Enrich with event counts per variant
  const enriched = await Promise.all(
    experiments.map(async (exp) => {
      const variants = exp.variants as any[];
      const variantStats = await Promise.all(
        variants.map(async (v: any) => {
          const assignments = await prisma.variantAssignment.count({
            where: { experimentId: exp.id, variantId: v.id },
          });
          const cartOpens = await prisma.event.count({
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'CART_OPENED',
            },
          });
          const checkoutClicks = await prisma.event.count({
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'CHECKOUT_CLICKED',
            },
          });
          const orders = await prisma.event.count({
            where: {
              assignment: { experimentId: exp.id, variantId: v.id },
              eventType: 'ORDER_COMPLETED',
            },
          });
          return {
            ...v,
            visitors: assignments,
            cartOpens,
            checkoutClicks,
            orders,
            checkoutRate: cartOpens > 0 ? (checkoutClicks / cartOpens * 100).toFixed(1) : '0.0',
          };
        })
      );
      return {
        ...exp,
        totalVisitors: exp._count.assignments,
        variantStats,
      };
    })
  );

  return NextResponse.json(enriched);
}

// POST /api/experiments — create experiment
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || !body.storeId || !body.name || !body.slot || !body.variants) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // Pause any existing running experiment in the same slot
  await prisma.experiment.updateMany({
    where: { storeId: body.storeId, slot: body.slot, status: 'RUNNING' },
    data: { status: 'PAUSED', endedAt: new Date() },
  });

  const variants = body.variants as any[];
  const trafficSplit: Record<string, number> = {};
  variants.forEach((v: any) => {
    trafficSplit[v.id] = 1 / variants.length;
  });

  const experiment = await prisma.experiment.create({
    data: {
      storeId: body.storeId,
      name: body.name,
      slot: body.slot,
      status: 'RUNNING',
      variants: body.variants,
      trafficSplit: body.trafficSplit || trafficSplit,
      maxDays: body.maxDays || 14,
    },
  });

  return NextResponse.json(experiment, { status: 201 });
}
