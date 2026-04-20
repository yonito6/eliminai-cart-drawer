import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/stores/:id/theme-status
 * Checks if the app embed is enabled on the store's published theme.
 * Returns: { enabled, themeId, themeName, editorUrl }
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const store = await prisma.store.findUnique({ where: { id } });
  if (!store) {
    return NextResponse.json({ error: 'Store not found' }, { status: 404 });
  }

  try {
    // Get access token
    const tokenRes = await fetch(`https://${store.shopDomain}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        grant_type: 'client_credentials',
      }),
    });
    if (!tokenRes.ok) {
      return NextResponse.json({ error: 'Auth failed' }, { status: 500 });
    }
    const { access_token } = await tokenRes.json();

    // Get the published theme
    const themesRes = await fetch(`https://${store.shopDomain}/admin/api/2025-01/themes.json`, {
      headers: { 'X-Shopify-Access-Token': access_token },
    });
    const { themes } = await themesRes.json();
    const mainTheme = themes?.find((t: any) => t.role === 'main');
    if (!mainTheme) {
      return NextResponse.json({ enabled: false, error: 'No published theme found' });
    }

    // Check if our app embed is enabled by reading theme settings
    const settingsRes = await fetch(
      `https://${store.shopDomain}/admin/api/2025-01/themes/${mainTheme.id}/assets.json?asset[key]=config/settings_data.json`,
      { headers: { 'X-Shopify-Access-Token': access_token } }
    );

    let enabled = false;
    if (settingsRes.ok) {
      const { asset } = await settingsRes.json();
      if (asset?.value) {
        try {
          const settings = JSON.parse(asset.value);
          // App embeds are stored under current.blocks with type matching our extension
          const blocks = settings?.current?.blocks || {};
          for (const block of Object.values(blocks) as any[]) {
            if (
              block.type &&
              block.type.includes('eliminai-cart-drawer') &&
              block.disabled !== true
            ) {
              enabled = true;
              break;
            }
          }
        } catch {}
      }
    }

    const editorUrl = `https://${store.shopDomain}/admin/themes/${mainTheme.id}/editor?context=apps`;

    return NextResponse.json({
      enabled,
      themeId: mainTheme.id,
      themeName: mainTheme.name,
      editorUrl,
      shopDomain: store.shopDomain,
    });
  } catch (err: any) {
    console.error('[theme-status] Error:', err.message);
    return NextResponse.json({ error: 'Failed to check theme status' }, { status: 500 });
  }
}
