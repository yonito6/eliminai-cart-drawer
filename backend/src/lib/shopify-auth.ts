import crypto from 'crypto';

export function buildInstallUrl(shop: string): string {
  const apiKey = process.env.SHOPIFY_API_KEY!;
  const scopes = process.env.SHOPIFY_SCOPES!;
  const redirectUri = `${process.env.HOST}/api/auth/callback`;
  const nonce = crypto.randomBytes(16).toString('hex');

  return `https://${shop}/admin/oauth/authorize?client_id=${apiKey}&scope=${encodeURIComponent(scopes)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${nonce}`;
}

export async function exchangeToken(shop: string, code: string): Promise<string> {
  const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.SHOPIFY_API_KEY,
      client_secret: process.env.SHOPIFY_API_SECRET,
      code,
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token exchange failed');
  return data.access_token;
}

/**
 * Register required webhooks for a store after install/re-auth.
 * Idempotent — Shopify deduplicates by topic+address.
 */
export async function registerWebhooks(shop: string, accessToken: string): Promise<void> {
  const host = process.env.HOST || process.env.SHOPIFY_APP_URL;
  if (!host) return;

  const webhooks = [
    { topic: 'orders/create', address: `${host}/api/proxy/webhook` },
    { topic: 'app/uninstalled', address: `${host}/api/webhooks/uninstalled` },
  ];

  for (const wh of webhooks) {
    try {
      // Convert REST topic format (orders/create) to GraphQL enum (ORDERS_CREATE)
      const gqlTopic = wh.topic.replace('/', '_').toUpperCase();
      const res = await fetch(`https://${shop}/admin/api/2025-10/graphql.json`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken,
        },
        body: JSON.stringify({
          query: `mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
              webhookSubscription { id }
              userErrors { field message }
            }
          }`,
          variables: {
            topic: gqlTopic,
            webhookSubscription: {
              callbackUrl: wh.address,
              format: 'JSON',
            },
          },
        }),
      });
      if (!res.ok) {
        console.error(`Webhook registration failed for ${wh.topic}:`, res.status, await res.text());
      }
    } catch (err) {
      console.error(`Webhook registration error for ${wh.topic}:`, err);
    }
  }
}

export function verifyHmac(query: Record<string, string>): boolean {
  const { hmac, ...params } = query;
  if (!hmac) return false;
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  const computed = crypto.createHmac('sha256', process.env.SHOPIFY_API_SECRET!).update(sorted).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(hmac, 'hex'));
  } catch {
    return false;
  }
}
