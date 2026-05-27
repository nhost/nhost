import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import refreshMaterializedView from './refreshMaterializedView';

const defaultOptions = {
  dataSource: 'default',
  appUrl: 'http://localhost:1337',
  adminSecret: 'test-admin-secret',
};

let capturedBody: unknown = null;

const server = setupServer(
  http.post('http://localhost:1337/v2/query', async ({ request }) => {
    capturedBody = await request.json();
    return HttpResponse.json({ result_type: 'CommandOk', result: null });
  }),
);

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  capturedBody = null;
});
afterAll(() => server.close());

describe('refreshMaterializedView', () => {
  test('should produce REFRESH MATERIALIZED VIEW SQL', async () => {
    await refreshMaterializedView({
      ...defaultOptions,
      schema: 'analytics',
      table: 'daily_stats',
    });

    const body = capturedBody as { args: { source: string; sql: string } };

    expect(body.args.source).toBe('default');
    expect(body.args.sql).toBe(
      'REFRESH MATERIALIZED VIEW analytics.daily_stats;',
    );
  });

  test('should quote unsafe identifiers', async () => {
    await refreshMaterializedView({
      ...defaultOptions,
      schema: 'analytics schema',
      table: 'Daily Stats',
    });

    const body = capturedBody as { args: { sql: string } };

    expect(body.args.sql).toBe(
      'REFRESH MATERIALIZED VIEW "analytics schema"."Daily Stats";',
    );
  });
});
