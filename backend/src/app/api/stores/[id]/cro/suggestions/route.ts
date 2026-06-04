import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { CRO_SUGGESTIONS } from '@/lib/cro-suggestions';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { key } = await req.json().catch(() => ({ key: undefined }));
  if (!CRO_SUGGESTIONS.some(s => s.key === key)) {
    return NextResponse.json({ error: 'Unknown suggestion' }, { status: 400 });
  }
  const store = await prisma.store.findUnique({ where: { id: params.id } });
  if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  const cfg = (store.config as Record<string, any>) ?? {};
  const activated: string[] = cfg.croSuggestions?.activated ?? [];
  const next = activated.includes(key) ? activated : [...activated, key];
  await prisma.store.update({
    where: { id: params.id },
    data: { config: { ...cfg, croSuggestions: { activated: next } } },
  });
  return NextResponse.json({ ok: true, activated: next });
}
