import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import type { DataBrowserGridRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import updateRecord from './updateRecord';

const defaultOptions = {
  dataSource: 'default',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-admin-secret',
  schema: 'public',
  table: 'users',
};

type RowCell = {
  id: string;
  isPrimary?: boolean;
  specificType: string;
  value: unknown;
};

function makeRow(cells: RowCell[]): DataBrowserGridRow {
  const original = Object.fromEntries(cells.map((c) => [c.id, c.value]));
  return {
    original,
    getAllCells: () =>
      cells.map((c) => ({
        column: {
          id: c.id,
          columnDef: {
            meta: {
              id: c.id,
              isPrimary: c.isPrimary ?? false,
              specificType: c.specificType,
            },
          },
        },
      })),
  } as unknown as DataBrowserGridRow;
}

let capturedBody: unknown = null;

const server = setupServer(
  http.post('http://localhost:1337/v2/query', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json([
      { result_type: 'CommandOk', result: null },
      {
        result_type: 'TuplesOk',
        result: [['data'], ['{"id":1,"name":"Alice"}']],
      },
    ]);
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedBody = null;
});
afterAll(() => server.close());

type CapturedRequest = { args: Array<{ args: { sql: string } }> };

describe('updateRecord', () => {
  test('updates a scalar column using SQL literal syntax', async () => {
    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 1 },
      { id: 'name', specificType: 'text', value: 'Alice' },
    ]);

    await updateRecord({
      ...defaultOptions,
      row,
      columnsToUpdate: { name: { value: 'Bob' } },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toMatch(/UPDATE/);
    expect(sql).toContain('Bob');
    expect(sql).not.toContain('ARRAY[');
  });

  test('updates an array column using ARRAY[...] syntax', async () => {
    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 1 },
      { id: 'tags', specificType: 'text[]', value: ['a', 'b'] },
    ]);

    await updateRecord({
      ...defaultOptions,
      row,
      columnsToUpdate: { tags: { value: '["x","y"]' } },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('ARRAY[');
    expect(sql).toContain("'x'");
    expect(sql).toContain("'y'");
    expect(sql).not.toMatch(/tags = '(\[.*\])'/);
  });

  test('sets a column to NULL when reset is true', async () => {
    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 1 },
      { id: 'bio', specificType: 'text', value: 'hello' },
    ]);

    await updateRecord({
      ...defaultOptions,
      row,
      columnsToUpdate: { bio: { value: null, reset: true } },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('bio = NULL');
  });

  test('builds the WHERE clause from primary key columns', async () => {
    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 42 },
      { id: 'name', specificType: 'text', value: 'Alice' },
    ]);

    await updateRecord({
      ...defaultOptions,
      row,
      columnsToUpdate: { name: { value: 'Bob' } },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toMatch(/WHERE/);
    expect(sql).toContain('42');
  });

  test('throws when no primary key column is present', async () => {
    const row = makeRow([{ id: 'name', specificType: 'text', value: 'Alice' }]);

    await expect(
      updateRecord({
        ...defaultOptions,
        row,
        columnsToUpdate: { name: { value: 'Bob' } },
      }),
    ).rejects.toThrow('No primary keys found for row.');
  });

  test('throws a descriptive error when an array column value is not valid JSON', async () => {
    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 1 },
      { id: 'tags', specificType: 'text[]', value: ['a'] },
    ]);

    await expect(
      updateRecord({
        ...defaultOptions,
        row,
        columnsToUpdate: { tags: { value: '{a,b}' } },
      }),
    ).rejects.toThrow('Invalid array value for column "tags"');
  });

  test('throws a normalized error when the server returns an error', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json(
          {
            error: 'relation "public.users" does not exist',
            code: '42P01',
          },
          { status: 400 },
        ),
      ),
    );

    const row = makeRow([
      { id: 'id', isPrimary: true, specificType: 'integer', value: 1 },
      { id: 'name', specificType: 'text', value: 'Alice' },
    ]);

    await expect(
      updateRecord({
        ...defaultOptions,
        row,
        columnsToUpdate: { name: { value: 'Bob' } },
      }),
    ).rejects.toThrow();
  });
});
