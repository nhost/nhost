import { vi } from 'vitest';
import fetchTableSchema from '@/features/orgs/projects/database/common/hooks/useTableSchemaQuery/fetchTableSchema';
import fetchTable from '@/features/orgs/projects/database/dataGrid/hooks/useTableQuery/fetchTable';
import { POSTGRESQL_ERROR_CODES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

const COLUMN_ROW = JSON.stringify({
  column_name: 'b',
  ordinal_position: 1,
  data_type: 'text',
  udt_name: 'text',
});

const CONSTRAINT_ROWS = [
  {
    constraint_name: 'table_pkey',
    constraint_type: 'p',
    column_name: 'id',
    column_ordinality: 1,
  },
  {
    constraint_name: 'first_key',
    constraint_type: 'u',
    column_name: 'b',
    column_ordinality: 2,
  },
  {
    constraint_name: 'first_key',
    constraint_type: 'u',
    column_name: 'a',
    column_ordinality: 1,
  },
  {
    constraint_name: 'second_key',
    constraint_type: 'u',
    column_name: 'a',
    column_ordinality: 1,
  },
  {
    constraint_name: 'second_key',
    constraint_type: 'u',
    column_name: 'b',
    column_ordinality: 2,
  },
  {
    constraint_name: 'legacy_idx',
    constraint_type: 'i',
    column_name: 'a',
    column_ordinality: 1,
  },
];

const SCHEMA_RESPONSE = [
  { result: [['row_to_json'], [COLUMN_ROW]] },
  {
    result: [
      ['row_to_json'],
      ...CONSTRAINT_ROWS.map((constraint) => [JSON.stringify(constraint)]),
    ],
  },
];

const ROW_RESPONSE = [
  { result: [['row_to_json'], [JSON.stringify({ b: 'value' })]] },
  { result: [['count'], ['1']] },
];

const OPTIONS = {
  dataSource: 'default',
  schema: 'public',
  table: 'example',
  appUrl: 'https://local.example',
  adminSecret: 'secret',
} as const;

function response(payload: unknown, ok = true) {
  return { ok, json: async () => payload } as Response;
}

function queryError(statusCode: string) {
  return {
    code: 'unexpected',
    error: 'query failed',
    path: '$',
    internal: {
      arguments: [],
      prepared: false,
      statement: '',
      error: {
        exec_status: 'FatalError',
        message: 'query failed',
        status_code: statusCode,
      },
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('candidate-key fetch metadata', () => {
  it('returns equivalent ordered metadata from schema-only and full-row paths', async () => {
    const schemaFetch = vi.fn().mockResolvedValue(response(SCHEMA_RESPONSE));
    vi.stubGlobal('fetch', schemaFetch);
    const schemaResult = await fetchTableSchema(OPTIONS);

    const tableFetch = vi
      .fn()
      .mockResolvedValueOnce(response(SCHEMA_RESPONSE))
      .mockResolvedValueOnce(response(ROW_RESPONSE));
    vi.stubGlobal('fetch', tableFetch);
    const tableResult = await fetchTable(OPTIONS);

    expect({
      candidateKeys: tableResult.candidateKeys,
      uniqueConstraints: tableResult.uniqueConstraints,
      constraintColumnSets: tableResult.constraintColumnSets,
    }).toEqual({
      candidateKeys: schemaResult.candidateKeys,
      uniqueConstraints: schemaResult.uniqueConstraints,
      constraintColumnSets: schemaResult.constraintColumnSets,
    });
    expect(schemaResult.candidateKeys.map(({ name }) => name)).toEqual([
      'table_pkey',
      'first_key',
      'second_key',
      'legacy_idx',
    ]);
    expect(schemaResult.uniqueConstraints.map(({ columns }) => columns)).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ]);
  });

  it.each([
    ['schema', POSTGRESQL_ERROR_CODES.SCHEMA_NOT_FOUND],
    ['table', POSTGRESQL_ERROR_CODES.TABLE_NOT_FOUND],
    ['columns', POSTGRESQL_ERROR_CODES.COLUMNS_NOT_FOUND],
  ])('returns empty metadata when %s lookup fails', async (_, statusCode) => {
    const errorResponse = response(queryError(statusCode), false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse));
    const schemaResult = await fetchTableSchema(OPTIONS);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(errorResponse));
    const tableResult = await fetchTable(OPTIONS);

    for (const result of [schemaResult, tableResult]) {
      expect(result.candidateKeys).toEqual([]);
      expect(result.uniqueConstraints).toEqual([]);
      expect(result.constraintColumnSets).toEqual([]);
    }
  });

  it('retains candidate metadata when fetching rows fails', async () => {
    const rowError = queryError('22000');
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(SCHEMA_RESPONSE))
      .mockResolvedValueOnce(response(rowError, false));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchTable(OPTIONS);

    expect(result.error).toBe('query failed');
    expect(result.candidateKeys).toHaveLength(4);
    expect(result.uniqueConstraints).toHaveLength(2);
    expect(result.constraintColumnSets).toEqual([['id'], ['a', 'b'], ['a']]);
  });
});
