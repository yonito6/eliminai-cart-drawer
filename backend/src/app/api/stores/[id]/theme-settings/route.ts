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

    // Fetch the active theme via GraphQL
    const gqlUrl = `https://${store.shopDomain}/admin/api/2025-10/graphql.json`;
    const gqlHeaders = { 'X-Shopify-Access-Token': store.accessToken, 'Content-Type': 'application/json' };

    const themesGql = await fetch(gqlUrl, {
      method: 'POST', headers: gqlHeaders,
      body: JSON.stringify({ query: `{ themes(first: 10, roles: MAIN) { nodes { id name role } } }` }),
    }).then(r => r.json());
    const activeTheme = themesGql?.data?.themes?.nodes?.[0];
    if (!activeTheme) return NextResponse.json({ error: 'No active theme' }, { status: 404 });

    // Fetch settings_data.json via theme asset query
    const assetGql = await fetch(gqlUrl, {
      method: 'POST', headers: gqlHeaders,
      body: JSON.stringify({
        query: `query themeAsset($themeId: ID!, $key: String!) {
          theme(id: $themeId) { file(filename: $key) { body { ... on OnlineStoreThemeFileBodyText { content } } } }
        }`,
        variables: { themeId: activeTheme.id, key: 'config/settings_data.json' },
      }),
    }).then(r => r.json());
    const settingsRaw = assetGql?.data?.theme?.file?.body?.content;
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
