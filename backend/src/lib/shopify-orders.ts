import type { OrdersAgg } from './cro-baseline';

const API_VERSION = '2025-10';
const MAX_PAGES = 40; // 40 * 250 = 10k orders / 30d cap

export async function fetchOrders30d(shopDomain: string, accessToken: string): Promise<OrdersAgg> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  let cursor: string | null = null;
  let orderCount = 0;
  let totalRevenue = 0;
  let currency = 'USD';

  for (let i = 0; i < MAX_PAGES; i++) {
    const after: string = cursor ? `, after: "${cursor}"` : '';
    const query = `{
      orders(first: 250, query: "created_at:>='${since}'"${after}) {
        pageInfo { hasNextPage endCursor }
        edges { node { currentTotalPriceSet { shopMoney { amount currencyCode } } } }
      }
    }`;
    const res = await fetch(`https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`, {
      method: 'POST',
      headers: { 'X-Shopify-Access-Token': accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const json: any = await res.json();
    const conn = json?.data?.orders;
    if (!conn) break;
    for (const edge of conn.edges) {
      const money = edge?.node?.currentTotalPriceSet?.shopMoney;
      if (money) {
        orderCount += 1;
        totalRevenue += parseFloat(money.amount) || 0;
        if (money.currencyCode) currency = money.currencyCode;
      }
    }
    if (!conn.pageInfo?.hasNextPage) break;
    cursor = conn.pageInfo.endCursor;
  }

  return { orderCount, totalRevenue: Math.round(totalRevenue * 100) / 100, currency };
}
