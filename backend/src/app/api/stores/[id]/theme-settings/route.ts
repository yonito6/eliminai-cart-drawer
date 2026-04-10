import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const store = await prisma.store.findUnique({
      where: { id },
      select: { shopDomain: true, accessToken: true },
    });
    if (!store) return NextResponse.json({ error: 'Store not found' }, { status: 404 });

    // Fetch the active theme
    const themesRes = await fetch(
      `https://${store.shopDomain}/admin/api/2025-01/themes.json`,
      { headers: { 'X-Shopify-Access-Token': store.accessToken } }
    );
    const themesData = await themesRes.json();
    const activeTheme = themesData.themes?.find((t: any) => t.role === 'main');
    if (!activeTheme) return NextResponse.json({ error: 'No active theme' }, { status: 404 });

    // Fetch settings_data.json
    const assetRes = await fetch(
      `https://${store.shopDomain}/admin/api/2025-01/themes/${activeTheme.id}/assets.json?asset[key]=config/settings_data.json`,
      { headers: { 'X-Shopify-Access-Token': store.accessToken } }
    );
    const assetData = await assetRes.json();
    const settingsRaw = assetData.asset?.value;
    if (!settingsRaw) return NextResponse.json({ error: 'No settings data' }, { status: 404 });

    const settings = JSON.parse(settingsRaw);
    const current = settings.current || {};

    // Extract only ccd_* settings
    const ccdSettings: Record<string, any> = {};
    for (const [key, value] of Object.entries(current)) {
      if (key.startsWith('ccd_')) {
        ccdSettings[key] = value;
      }
    }

    return NextResponse.json({ themeSettings: ccdSettings });
  } catch (err: any) {
    console.error('[theme-settings] Error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch theme settings' }, { status: 500 });
  }
}
