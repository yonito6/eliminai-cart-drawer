import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET /api/experiments/:id — get experiment with full stats
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const experiment = await prisma.experiment.findUnique({
    where: { id: params.id },
    include: {
      _count: { select: { assignments: true, dailySummaries: true } },
      dailySummaries: { orderBy: { date: 'asc' } },
    },
  });

  if (!experiment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json(experiment);
}

// PATCH /api/experiments/:id — update experiment (pause, resume, end)
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json().catch(() => null);
  if (!body || !body.action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  const experiment = await prisma.experiment.findUnique({
    where: { id: params.id },
  });

  if (!experiment) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  switch (body.action) {
    case 'pause':
      await prisma.experiment.update({
        where: { id: params.id },
        data: { status: 'PAUSED' },
      });
      break;

    case 'resume':
      await prisma.experiment.update({
        where: { id: params.id },
        data: { status: 'RUNNING' },
      });
      break;

    case 'end':
      await prisma.experiment.update({
        where: { id: params.id },
        data: {
          status: body.winner ? 'WINNER_FOUND' : 'NO_DIFFERENCE',
          winnerVariantId: body.winner || null,
          endedAt: new Date(),
        },
      });
      break;

    case 'update-split':
      if (body.trafficSplit) {
        await prisma.experiment.update({
          where: { id: params.id },
          data: { trafficSplit: body.trafficSplit },
        });
      }
      break;

    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  }

  const updated = await prisma.experiment.findUnique({ where: { id: params.id } });
  return NextResponse.json(updated);
}
