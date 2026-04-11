import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getDefaultAddonsConfig } from '@/lib/addon-definitions';

// POST /api/stores/:id/addons/apply-recommended
// Enables the 3 recommended addons (trustBadges, freeShippingBar, scarcityTimer)
// in auto-optimize mode with a testing queue.
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const config = (store.config as Record<string, any>) ?? {};
  const existingAddons = (config.addons ?? {}) as Record<string, any>;

  const defaults = getDefaultAddonsConfig();
  const recommendedKeys = ['trustBadges', 'freeShippingBar', 'scarcityTimer'] as const;

  for (let i = 0; i < recommendedKeys.length; i++) {
    const key = recommendedKeys[i];
    const defaultAddon = defaults.addons[key];

    existingAddons[key] = {
      ...existingAddons[key],
      enabled: true,
      mode: 'auto-optimize',
      config: defaultAddon?.config ?? existingAddons[key]?.config ?? {},
      optimizeState: {
        queuePosition: i + 1,
        status: i === 0 ? 'testing' : 'queued',
      },
    };
  }

  const updated = await prisma.store.update({
    where: { id: params.id },
    data: {
      config: {
        ...config,
        addons: existingAddons,
        optimizeQueue: [...recommendedKeys],
      },
    },
  });

  return NextResponse.json({
    addons: ((updated.config as Record<string, any>)?.addons ?? {}),
  });
}
