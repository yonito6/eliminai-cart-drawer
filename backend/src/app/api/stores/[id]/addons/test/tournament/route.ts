import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createTournamentBracket, advanceTournament, getTournamentStatus } from '@/lib/tournament';
import { addExperimentNote } from '@/lib/test-safety';

// POST /api/stores/[id]/addons/test/tournament — start tournament
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = await req.json();
  const { slot, variants, name } = body;

  if (!slot || !variants || variants.length < 2) {
    return NextResponse.json({ error: 'slot and at least 2 variants required' }, { status: 400 });
  }

  // Pause existing running experiments in this slot
  await prisma.experiment.updateMany({
    where: { storeId: params.id, slot, status: 'RUNNING' },
    data: { status: 'PAUSED', endedAt: new Date() },
  });

  const bracket = createTournamentBracket(variants);
  const firstMatch = bracket.rounds[0]?.matches[0];

  if (!firstMatch) {
    return NextResponse.json({ error: 'Could not create bracket' }, { status: 400 });
  }

  // Create experiment for the first match
  const matchVariants = variants.filter(
    (v: any) => v.id === firstMatch.variantA || v.id === firstMatch.variantB
  );

  const notes = addExperimentNote([], 'started',
    `Tournament started: ${variants.length} variants, ${bracket.rounds.length} rounds`
  );

  const experiment = await prisma.experiment.create({
    data: {
      storeId: params.id,
      name: name || `${slot} Tournament`,
      slot,
      status: 'RUNNING',
      variants: matchVariants,
      trafficSplit: { [firstMatch.variantA]: 0.5, [firstMatch.variantB]: 0.5 },
      tournament: bracket,
      notes,
    },
  });

  return NextResponse.json({
    experiment,
    bracket: getTournamentStatus(bracket),
  }, { status: 201 });
}

// GET /api/stores/[id]/addons/test/tournament?slot=xxx — get tournament status
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const slot = req.nextUrl.searchParams.get('slot');

  const where: any = { storeId: params.id, tournament: { not: null } };
  if (slot) where.slot = slot;

  const experiments = await prisma.experiment.findMany({
    where,
    orderBy: { startedAt: 'desc' },
    take: 1,
  });

  if (experiments.length === 0) {
    return NextResponse.json({ error: 'No tournament found' }, { status: 404 });
  }

  const exp = experiments[0];
  const bracket = exp.tournament as any;

  return NextResponse.json({
    experimentId: exp.id,
    status: exp.status,
    bracket: getTournamentStatus(bracket),
  });
}
