import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchOrders30d } from '../lib/shopify-orders';

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
  beforeEach(() => vi.restoreAllMocks());

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
