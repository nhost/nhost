import { vi } from 'vitest';
import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';

const fetchMock = vi.fn();

const callOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'orders',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-secret',
};

describe('fetchTableSchema', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('fetches table schema without requesting row data', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { result_type: 'TuplesOk', result: [['row_to_json']] },
        { result_type: 'TuplesOk', result: [['row_to_json']] },
      ],
    } as Response);

    const result = await fetchTableSchema(callOptions);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      columns: [],
      foreignKeyRelations: [],
      error: null,
    });
  });
});
