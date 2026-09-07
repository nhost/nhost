import { vi } from 'vitest';
import fetchTable from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/fetchTable';

const fetchMock = vi.fn();

const callOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'orders',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-secret',
};

describe('fetchTable', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns rows and their total count', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { result_type: 'TuplesOk', result: [['row_to_json']] },
          { result_type: 'TuplesOk', result: [['row_to_json']] },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            result_type: 'TuplesOk',
            result: [
              ['row_to_json'],
              [JSON.stringify({ id: 'order-1', owner_id: 'owner-1' })],
            ],
          },
          { result_type: 'TuplesOk', result: [['count'], ['1']] },
        ],
      } as Response);

    const result = await fetchTable(callOptions);

    expect(result.error).toBeNull();
    expect(result.rows).toEqual([{ id: 'order-1', owner_id: 'owner-1' }]);
    expect(result.numberOfRows).toBe(1);
  });
});
