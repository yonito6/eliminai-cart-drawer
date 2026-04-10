import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addExperimentNote } from '@/lib/test-safety';

// POST — add a user note to an experiment
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string; expId: string } },
) {
  const experiment = await prisma.experiment.findUnique({
    where: { id: params.expId },
  });

  if (!experiment || experiment.storeId !== params.id) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  const body = await req.json();
  const { note } = body;

  if (!note || typeof note !== 'string') {
    return NextResponse.json({ error: 'note required' }, { status: 400 });
  }

  const updatedNotes = addExperimentNote(
    (experiment.notes as any[]) || null,
    'user_event',
    note,
  );

  await prisma.experiment.update({
    where: { id: params.expId },
    data: { notes: updatedNotes },
  });

  return NextResponse.json({ notes: updatedNotes });
}

// GET — get all notes for an experiment
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string; expId: string } },
) {
  const experiment = await prisma.experiment.findUnique({
    where: { id: params.expId },
    select: { notes: true, storeId: true },
  });

  if (!experiment || experiment.storeId !== params.id) {
    return NextResponse.json({ error: 'Experiment not found' }, { status: 404 });
  }

  return NextResponse.json({ notes: experiment.notes || [] });
}
