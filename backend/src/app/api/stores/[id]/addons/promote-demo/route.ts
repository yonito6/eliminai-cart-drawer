import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * POST /api/stores/:id/addons/promote-demo
 * Copies demoConfig → config (pushes demo settings to live).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  const demoConfig = (store.demoConfig as any) ?? {};
  if (!demoConfig.addons) {
    return NextResponse.json({ error: 'No demo config to promote' }, { status: 400 });
  }

  await prisma.store.update({
    where: { id: params.id },
    data: { config: demoConfig },
  });

  return NextResponse.json({ success: true, promoted: true });
}
