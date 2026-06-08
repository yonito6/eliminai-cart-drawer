import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/stores/:id/addons/experiments/history
// Read-only: every test ever run for this store, grouped by addon slot, newest first.
// Lightweight summary only — no per-variant event counting (that lives in the
// heavy /addons/experiments GET, which this endpoint intentionally does NOT touch).
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const experiments = await prisma.experiment.findMany({
    where: { storeId: params.id },
    orderBy: { startedAt: 'desc' },
    include: { _count: { select: { assignments: true } } },
  });

  const history: Record<string, any[]> = {};
  for (const exp of experiments) {
    const variants = (exp.variants as any[]) || [];
    const winnerLabel = exp.winnerVariantId
      ? (variants.find((v: any) => v.id === exp.winnerVariantId)?.label ?? null)
      : null;

    const summary = {
      id: exp.id,
      name: exp.name,
      slot: exp.slot,
      status: exp.status,
      confidence: exp.confidence,
      liftPercent: exp.liftPercent,
      winnerVariantId: exp.winnerVariantId,
      winnerLabel,
      totalVisitors: (exp as any)._count.assignments,
      startedAt: exp.startedAt,
      endedAt: exp.endedAt,
    };

    (history[exp.slot] ||= []).push(summary);
  }

  return NextResponse.json({ history });
}
