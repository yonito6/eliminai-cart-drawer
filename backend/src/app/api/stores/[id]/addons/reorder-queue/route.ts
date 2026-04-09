import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// POST /api/stores/:id/addons/reorder-queue
// Body: { queue: string[] } — addon keys in desired optimization order
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const body = await req.json();
  const { queue } = body as { queue: string[] };

  if (!Array.isArray(queue) || queue.length === 0) {
    return NextResponse.json(
      { error: 'queue must be a non-empty array of addon keys' },
      { status: 400 }
    );
  }

  const config = (store.config as Record<string, any>) ?? {};
  const addons = (config.addons ?? {}) as Record<string, any>;

  for (let i = 0; i < queue.length; i++) {
    const key = queue[i];
    if (!addons[key]) continue;

    addons[key].optimizeState = {
      ...(addons[key].optimizeState ?? {}),
      queuePosition: i + 1,
      status: i === 0 ? 'testing' : 'queued',
    };
  }

  const updated = await prisma.store.update({
    where: { id: params.id },
    data: {
      config: {
        ...config,
        addons,
        optimizeQueue: queue,
      },
    },
  });

  return NextResponse.json({
    addons: ((updated.config as Record<string, any>)?.addons ?? {}),
  });
}
