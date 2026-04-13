import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * PUT /api/stores/:id/demo-theme
 * Sets the demo theme ID for this store.
 */
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { themeId } = await req.json();

  await prisma.store.update({
    where: { id: params.id },
    data: { demoThemeId: themeId ? String(themeId) : null },
  });

  return NextResponse.json({ success: true, demoThemeId: themeId });
}
