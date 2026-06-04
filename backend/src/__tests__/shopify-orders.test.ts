import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOrders30d, fetchOrdersWindow } from '../lib/shopify-orders';

const page = (orders: number[], hasNext: boolean, cursor = 'c1') => ({
  data: {
    orders: {
      pageInfo: { hasNextPage: hasNext, endCursor: cursor },
      edges: orders.map(a => ({
        cursor,
        node: { currentTotalPriceSet: { shopMoney: { amount: String(a), currencyCode: 'USD' } } },
      })),
    },
  },
});

describe('fetchOrders30d', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('sums revenue and counts orders across paginated results', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ json: async () => page([100, 50], true) } as any)
      .mockResolvedValueOnce({ json: async () => page([25.5], false) } as any);

    const res = await fetchOrders30d('shop.myshopify.com', 'tok');
    expect(res).toEqual({ orderCount: 3, totalRevenue: 175.5, currency: 'USD' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe('https://shop.myshopify.com/admin/api/2025-10/graphql.json');
  });

  it('returns zeros and USD when there are no orders', async () => {
    vi.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ json: async () => page([], false) } as any);
    const res = await fetchOrders30d('shop.myshopify.com', 'tok');
    expect(res).toEqual({ orderCount: 0, totalRevenue: 0, currency: 'USD' });
  });
});

describe('fetchOrdersWindow', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  it('bounds the query with both since and until when until is provided', async () => {
    const fetchMock = vi.spyOn(global, 'fetch' as any)
      .mockResolvedValueOnce({ json: async () => page([40, 60], false) } as any);
    const res = await fetchOrdersWindow('shop.myshopify.com', 'tok', '2026-04-01T00:00:00.000Z', '2026-05-01T00:00:00.000Z');
    expect(res).toEqual({ orderCount: 2, totalRevenue: 100, currency: 'USD' });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as any).body);
    expect(body.query).toContain("created_at:>='2026-04-01T00:00:00.000Z'");
    expect(body.query).toContain("created_at:<'2026-05-01T00:00:00.000Z'");
  });
});
