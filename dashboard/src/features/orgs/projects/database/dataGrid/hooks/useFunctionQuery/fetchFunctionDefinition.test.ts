import { afterEach, beforeEach, vi } from 'vitest';
import fetchFunctionDefinition, {
  type FunctionDefinitionRow,
} from './fetchFunctionDefinition';

const fetchMock = vi.fn();

function row(
  overrides: Partial<FunctionDefinitionRow> = {},
): FunctionDefinitionRow {
  return {
    function_definition:
      'CREATE FUNCTION my_fn() RETURNS SETOF public.mytable ...',
    function_name: 'my_fn',
    function_schema: 'public',
    function_type: 'VOLATILE',
    return_type_name: 'mytable',
    return_type_schema: 'public',
    return_type_kind: 'c',
    returns_set: true,
    has_variadic: false,
    language: 'sql',
    input_arg_types: [],
    default_args_count: 0,
    return_table_name: 'mytable',
    return_table_schema: 'public',
    comment: null,
    ...overrides,
  };
}

function ok(body: unknown) {
  return { ok: true, json: async () => body } as Response;
}

function rowsResponse(rowOverrides: Partial<FunctionDefinitionRow> = {}) {
  return ok([{ result: [['data'], [JSON.stringify(row(rowOverrides))]] }]);
}

const callArgs = {
  appUrl: 'https://hasura.example',
  adminSecret: 'secret',
  dataSource: 'default',
  functionOID: '42',
};

describe('fetchFunctionDefinition', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('maps SETOF composite function metadata including the new fields', async () => {
    fetchMock.mockResolvedValueOnce(rowsResponse());
    const result = await fetchFunctionDefinition(callArgs);
    expect(result.functionMetadata).toMatchObject({
      functionName: 'my_fn',
      returnTypeKind: 'c',
      returnsSet: true,
      hasVariadic: false,
      returnTableName: 'mytable',
    });
    expect(result.error).toBeNull();
  });

  it('sets returnsSet=false for single-row composite functions', async () => {
    fetchMock.mockResolvedValueOnce(rowsResponse({ returns_set: false }));
    const result = await fetchFunctionDefinition(callArgs);
    expect(result.functionMetadata?.returnsSet).toBe(false);
  });

  it('sets hasVariadic=true when the function declares a VARIADIC argument', async () => {
    fetchMock.mockResolvedValueOnce(rowsResponse({ has_variadic: true }));
    const result = await fetchFunctionDefinition(callArgs);
    expect(result.functionMetadata?.hasVariadic).toBe(true);
  });

  it('passes non-composite returnTypeKind through (e.g. enum)', async () => {
    fetchMock.mockResolvedValueOnce(
      rowsResponse({
        return_type_kind: 'e',
        return_type_name: 'mood',
        return_table_name: null,
        return_table_schema: null,
      }),
    );
    const result = await fetchFunctionDefinition(callArgs);
    expect(result.functionMetadata?.returnTypeKind).toBe('e');
    expect(result.functionMetadata?.returnTypeName).toBe('mood');
  });

  it('returns a not-found error when the query yields no rows', async () => {
    fetchMock.mockResolvedValueOnce(ok([{ result: [['data']] }]));
    const result = await fetchFunctionDefinition(callArgs);
    expect(result.functionMetadata).toBeNull();
    expect(result.error).toBe('Function definition not found.');
  });
});
