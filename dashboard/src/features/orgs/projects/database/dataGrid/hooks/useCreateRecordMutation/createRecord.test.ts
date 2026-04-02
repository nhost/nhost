import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import createRecord from './createRecord';

const defaultOptions = {
  dataSource: 'default',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-admin-secret',
  schema: 'public',
  table: 'users',
};

let capturedBody: unknown = null;

const server = setupServer(
  http.post('http://localhost:1337/v2/query', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json([{ result_type: 'CommandOk', result: null }]);
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedBody = null;
});
afterAll(() => server.close());

type CapturedRequest = { args: Array<{ args: { sql: string } }> };

describe('createRecord', () => {
  test('inserts scalar values as SQL literals', async () => {
    await createRecord({
      ...defaultOptions,
      columnValues: {
        name: { value: 'Alice' },
      },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toMatch(/INSERT INTO/);
    expect(sql).toContain('Alice');
    expect(sql).not.toContain('ARRAY[');
  });

  test('inserts array values using ARRAY[...] syntax', async () => {
    await createRecord({
      ...defaultOptions,
      columnValues: {
        tags: { value: '["a","b","c"]', specificType: 'text[]' },
      },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('ARRAY[');
    expect(sql).toContain("'a'");
    expect(sql).toContain("'b'");
    expect(sql).toContain("'c'");
    // must not be inserted as a plain string literal like '[...]'
    expect(sql).not.toMatch(/'(\[.*\])'/);
  });

  test('inserts integer array values using ARRAY[...] syntax', async () => {
    await createRecord({
      ...defaultOptions,
      columnValues: {
        scores: { value: '[1,2,3]', specificType: 'integer[]' },
      },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('ARRAY[');
    expect(sql).not.toMatch(/'(\[.*\])'/);
  });

  test('uses DEFAULT when value is absent and column has a default', async () => {
    await createRecord({
      ...defaultOptions,
      columnValues: {
        id: { value: undefined, fallbackValue: 'DEFAULT' },
      },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('DEFAULT');
  });

  test('uses NULL when value is absent and column is nullable', async () => {
    await createRecord({
      ...defaultOptions,
      columnValues: {
        bio: { value: null, fallbackValue: 'NULL' },
      },
    });

    const sql = (capturedBody as CapturedRequest).args[0].args.sql;
    expect(sql).toContain('NULL');
  });

  test('throws a descriptive error when an array column value is not valid JSON', async () => {
    await expect(
      createRecord({
        ...defaultOptions,
        columnValues: {
          tags: { value: '{a,b}', specificType: 'text[]' },
        },
      }),
    ).rejects.toThrow('Invalid array value for column "tags"');
  });

  test('throws a normalized error when the server returns an error', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json(
          {
            error: 'column "name" of relation "users" does not exist',
            code: '42703',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      createRecord({
        ...defaultOptions,
        columnValues: { name: { value: 'Alice' } },
      }),
    ).rejects.toThrow();
  });
});
