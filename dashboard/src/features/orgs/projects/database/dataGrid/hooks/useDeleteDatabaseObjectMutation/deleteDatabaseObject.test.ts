import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import type { DatabaseObjectType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import deleteDatabaseObject from './deleteDatabaseObject';

const defaultOptions = {
  dataSource: 'default',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-admin-secret',
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

describe('deleteDatabaseObject', () => {
  test('should produce DROP TABLE SQL for ORDINARY TABLE', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'users',
      type: 'ORDINARY TABLE',
    });

    const body = capturedBody as { args: Array<{ args: { sql: string } }> };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP TABLE');
    expect(sql).toContain('public');
    expect(sql).toContain('users');
  });

  test('should produce DROP VIEW SQL for VIEW', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'active_users',
      type: 'VIEW',
    });

    const body = capturedBody as { args: Array<{ args: { sql: string } }> };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP VIEW');
    expect(sql).not.toContain('MATERIALIZED');
    expect(sql).toContain('active_users');
  });

  test('should produce DROP MATERIALIZED VIEW SQL for MATERIALIZED VIEW', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'analytics',
      objectName: 'daily_stats',
      type: 'MATERIALIZED VIEW',
    });

    const body = capturedBody as { args: Array<{ args: { sql: string } }> };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP MATERIALIZED VIEW');
    expect(sql).toContain('analytics');
    expect(sql).toContain('daily_stats');
  });

  test('should produce DROP FOREIGN TABLE SQL for FOREIGN TABLE', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'external_data',
      type: 'FOREIGN TABLE',
    });

    const body = capturedBody as { args: Array<{ args: { sql: string } }> };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP FOREIGN TABLE');
    expect(sql).toContain('external_data');
  });

  test('should send the correct data source', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      dataSource: 'my_source',
      schema: 'public',
      objectName: 'test',
      type: 'ORDINARY TABLE',
    });

    const body = capturedBody as { args: Array<{ args: { source: string } }> };
    expect(body.args[0].args.source).toBe('my_source');
  });

  test('should produce DROP FUNCTION SQL for FUNCTION with no parameters', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'get_users',
      type: 'FUNCTION',
      inputArgTypes: [],
    });

    const body = capturedBody as {
      args: Array<{ args: { sql: string; cascade: boolean } }>;
    };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP FUNCTION');
    expect(sql).toContain('public');
    expect(sql).toContain('get_users');
    expect(body.args[0].args.cascade).toBe(false);
  });

  test('should produce DROP FUNCTION SQL for FUNCTION with parameters', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'search_users',
      type: 'FUNCTION',
      inputArgTypes: [
        { name: 'query', type: 'text', displayType: 'text', schema: null },
        { name: 'limit', type: 'int4', displayType: 'integer', schema: null },
      ],
    });

    const body = capturedBody as {
      args: Array<{ args: { sql: string; cascade: boolean } }>;
    };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP FUNCTION');
    expect(sql).toContain('search_users');
    expect(sql).toContain('text');
    expect(sql).toContain('int4');
    expect(body.args[0].args.cascade).toBe(false);
  });

  test('should produce DROP FUNCTION SQL with schema-qualified parameter types', async () => {
    await deleteDatabaseObject({
      ...defaultOptions,
      schema: 'public',
      objectName: 'process',
      type: 'FUNCTION',
      inputArgTypes: [
        {
          name: 'input',
          type: 'my_type',
          displayType: 'my_type',
          schema: 'custom',
        },
      ],
    });

    const body = capturedBody as {
      args: Array<{ args: { sql: string; cascade: boolean } }>;
    };
    const sql = body.args[0].args.sql;
    expect(sql).toContain('DROP FUNCTION');
    expect(sql).toContain('custom');
    expect(sql).toContain('my_type');
    expect(body.args[0].args.cascade).toBe(false);
  });

  test('should throw an error for unsupported object type', async () => {
    await expect(
      deleteDatabaseObject({
        ...defaultOptions,
        schema: 'public',
        objectName: 'test',
        type: 'UNKNOWN_TYPE' as DatabaseObjectType,
      }),
    ).rejects.toThrow('Unsupported database object type: UNKNOWN_TYPE');
  });

  test('should throw a normalized error when the server returns an error', async () => {
    server.use(
      http.post('http://localhost:1337/v2/query', () =>
        HttpResponse.json(
          {
            error: 'relation "public.test" does not exist',
            code: 'not-exists',
          },
          { status: 400 },
        ),
      ),
    );

    await expect(
      deleteDatabaseObject({
        ...defaultOptions,
        schema: 'public',
        objectName: 'test',
        type: 'ORDINARY TABLE',
      }),
    ).rejects.toThrow();
  });
});
