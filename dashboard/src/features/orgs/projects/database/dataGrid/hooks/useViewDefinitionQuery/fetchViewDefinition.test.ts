import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import fetchViewDefinition from './fetchViewDefinition';

const defaultOptions = {
  dataSource: 'default',
  schema: 'public',
  table: 'active_users',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-admin-secret',
};

let capturedBody: unknown = null;

const server = setupServer(
  http.post('http://localhost:1337/v2/query', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json([
      {
        result_type: 'TuplesOk',
        result: [
          ['view_definition', 'view_type'],
          ['SELECT id, name FROM users;', 'VIEW'],
        ],
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

describe('fetchViewDefinition', () => {
  test('should return view definition and type VIEW', async () => {
    const result = await fetchViewDefinition(defaultOptions);

    expect(result).toEqual({
      viewDefinition: 'SELECT id, name FROM users;',
      viewType: 'VIEW',
      error: null,
    });
  });

  test('should return type MATERIALIZED VIEW', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json([
          {
            result_type: 'TuplesOk',
            result: [
              ['view_definition', 'view_type'],
              ['SELECT count(*) FROM orders;', 'MATERIALIZED VIEW'],
            ],
          },
        ]),
      ),
    );

    const result = await fetchViewDefinition(defaultOptions);

    expect(result).toEqual({
      viewDefinition: 'SELECT count(*) FROM orders;',
      viewType: 'MATERIALIZED VIEW',
      error: null,
    });
  });

  test('should return error when no results found', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json([
          {
            result_type: 'TuplesOk',
            result: [['view_definition', 'view_type']],
          },
        ]),
      ),
    );

    const result = await fetchViewDefinition(defaultOptions);

    expect(result).toEqual({
      viewDefinition: '',
      viewType: 'VIEW',
      error: 'View definition not found.',
    });
  });

  test('should return internal error message', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json(
          {
            internal: {
              error: { message: 'relation does not exist' },
            },
            error: 'query execution failed',
          },
          { status: 400 },
        ),
      ),
    );

    const result = await fetchViewDefinition(defaultOptions);

    expect(result).toEqual({
      viewDefinition: '',
      viewType: 'VIEW',
      error: 'relation does not exist',
    });
  });

  test('should return error field message when no internal field', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json({ error: 'permission denied' }, { status: 400 }),
      ),
    );

    const result = await fetchViewDefinition(defaultOptions);

    expect(result).toEqual({
      viewDefinition: '',
      viewType: 'VIEW',
      error: 'permission denied',
    });
  });

  test('should send the correct request parameters', async () => {
    await fetchViewDefinition({
      ...defaultOptions,
      dataSource: 'my_source',
      schema: 'analytics',
      table: 'daily_stats',
    });

    const body = capturedBody as {
      args: Array<{ args: { source: string; sql: string } }>;
      type: string;
    };

    expect(body.type).toBe('bulk');
    expect(body.args[0].args.source).toBe('my_source');
    expect(body.args[0].args.sql).toContain('analytics');
    expect(body.args[0].args.sql).toContain('daily_stats');
    expect(body.args[0].args.sql).toContain('pg_get_viewdef');
  });
});
