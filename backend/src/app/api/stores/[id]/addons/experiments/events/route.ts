import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/:id/addons/experiments/events — raw events for debugging
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const storeId = params.id;
  const url = new URL(req.url);
  const experimentId = url.searchParams.get('experimentId');

  if (!experimentId) {
    return NextResponse.json({ error: 'Missing experimentId query param' }, { status: 400 });
  }

  // Get all events linked to this experiment's assignments
  const events = await prisma.event.findMany({
    where: {
      storeId,
      assignment: { experimentId },
    },
    include: {
      assignment: { select: { variantId: true } },
      session: { select: { sessionToken: true, deviceType: true, isReturning: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // Group by variant for readability
  const byVariant: Record<string, any[]> = {};
  for (const ev of events) {
    const vid = ev.assignment?.variantId || 'unassigned';
    if (!byVariant[vid]) byVariant[vid] = [];
    byVariant[vid].push({
      eventType: ev.eventType,
      createdAt: ev.createdAt,
      sessionToken: ev.session?.sessionToken?.slice(0, 8) + '...',
      deviceType: ev.session?.deviceType,
      metadata: ev.metadata,
    });
  }

  // Summary counts
  const summary: Record<string, Record<string, number>> = {};
  for (const [vid, evts] of Object.entries(byVariant)) {
    summary[vid] = {};
    for (const e of evts) {
      summary[vid][e.eventType] = (summary[vid][e.eventType] || 0) + 1;
    }
  }

  return NextResponse.json({ experimentId, summary, events: byVariant });
}
