import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

function parseConfig(store: { config: any }): Record<string, any> {
  if (typeof store.config === 'string') {
    try { return JSON.parse(store.config); } catch { return {}; }
  }
  return (store.config as Record<string, any>) ?? {};
}

// GET /api/stores/:id/layout — returns layout settings
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const config = parseConfig(store);
  return NextResponse.json({
    desktopWidth: config.desktopWidth ?? 480,
  });
}

// PATCH /api/stores/:id/layout — update layout settings
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const config = parseConfig(store);

  if (typeof body.desktopWidth === 'number' && body.desktopWidth >= 320 && body.desktopWidth <= 800) {
    config.desktopWidth = body.desktopWidth;
  }

  await prisma.store.update({
    where: { id: params.id },
    data: { config },
  });

  return NextResponse.json({
    desktopWidth: config.desktopWidth ?? 480,
  });
}
