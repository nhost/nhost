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

  it('lists columns explicitly and reads PostGIS columns as GeoJSON', async () => {
    const columns = [
      {
        column_name: 'id',
        data_type: 'integer',
        udt_name: 'int4',
        full_data_type: 'integer',
        is_primary: true,
      },
      {
        column_name: 'location',
        data_type: 'USER-DEFINED',
        udt_name: 'geometry',
        full_data_type: 'geometry(Point,4326)',
      },
      {
        column_name: 'route',
        data_type: 'USER-DEFINED',
        udt_name: 'geography',
        full_data_type: 'geography(LineString,4326)',
      },
      {
        column_name: 'shapes',
        data_type: 'ARRAY',
        udt_name: '_geometry',
        full_data_type: 'geometry[]',
      },
    ];

    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          {
            result_type: 'TuplesOk',
            result: [
              ['row_to_json'],
              ...columns.map((column) => [JSON.stringify(column)]),
            ],
          },
          { result_type: 'TuplesOk', result: [['row_to_json']] },
        ],
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [
          { result_type: 'TuplesOk', result: [['row_to_json']] },
          { result_type: 'TuplesOk', result: [['count'], ['0']] },
        ],
      } as Response);

    await fetchTable(callOptions);

    const body = JSON.parse(fetchMock.mock.calls[1][1].body as string);
    const sql: string = body.args[0].args.sql;

    expect(sql).toContain(
      'SELECT id, CASE WHEN ST_GeometryType(location::geometry) IN (',
    );
    expect(sql).toContain(
      'ELSE ST_AsGeoJSON(location, 15, 4)::json END AS location, CASE WHEN ST_GeometryType(route::geometry)',
    );
    expect(sql).toContain(
      'ELSE ST_AsGeoJSON(route, 15, 4)::json END AS route, shapes FROM (SELECT * FROM public.orders',
    );
    expect(sql).toMatch(/ORDER BY .* LIMIT \d+\) SOURCE_ROWS\) TABLE_DATA/);
  });
});
