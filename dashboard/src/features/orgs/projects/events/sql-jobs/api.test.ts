import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import {
  buildSqlJobMigration,
  executeSqlJobChange,
  fetchSqlJobRows,
} from '@/features/orgs/projects/events/sql-jobs/api';
import {
  createSqlJobChange,
  deleteSqlJobChange,
  editSqlJobChange,
  getJobRunsSql,
} from '@/features/orgs/projects/events/sql-jobs/sql';
import { sqlJobFixture } from '@/features/orgs/projects/events/sql-jobs/test-fixtures';

const target = {
  appUrl: 'https://local.hasura.local.nhost.run',
  adminSecret: 'test-secret',
};
const change = {
  name: 'update_sql_job',
  up: 'SELECT 1;\n-- keep\nSELECT 2;',
  down: 'SELECT 3;',
};
const server = setupServer();
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SQL Jobs transport', () => {
  it('records every local write as an executable, reversible Hasura migration', async () => {
    let body: unknown;
    server.use(
      http.post(`${target.appUrl}/apis/migrate`, async ({ request }) => {
        body = await request.json();
        expect(request.headers.get('x-hasura-admin-secret')).toBe(
          target.adminSecret,
        );
        return HttpResponse.json({ name: change.name, version: 1 });
      }),
    );
    await executeSqlJobChange(target, false, change);
    expect(body).toEqual({
      name: change.name,
      datasource: 'default',
      skip_execution: false,
      up: [
        {
          type: 'run_sql',
          args: {
            source: 'default',
            sql: change.up,
            cascade: false,
            read_only: false,
          },
        },
      ],
      down: [
        {
          type: 'run_sql',
          args: {
            source: 'default',
            sql: change.down,
            cascade: false,
            read_only: false,
          },
        },
      ],
    });
  });

  it('uses plain SQL without migrations on hosted projects', async () => {
    let body: unknown;
    server.use(
      http.post(`${target.appUrl}/v2/query`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ result_type: 'CommandOk', result: null });
      }),
    );
    await executeSqlJobChange(target, true, change);
    expect(body).toEqual(buildSqlJobMigration(change).up[0]);
  });

  it('uses read-only SQL for reads, even locally, and preserves bigint identifiers', async () => {
    server.use(
      http.post(`${target.appUrl}/v2/query`, async ({ request }) => {
        expect(await request.json()).toMatchObject({
          args: { source: 'default', read_only: true, sql: 'SELECT data' },
        });
        return HttpResponse.json({
          result_type: 'TuplesOk',
          result: [['data'], [JSON.stringify(sqlJobFixture)]],
        });
      }),
    );
    expect(await fetchSqlJobRows(target, 'SELECT data')).toEqual([
      sqlJobFixture,
    ]);
  });

  it('surfaces nested errors from the CLI migration API', async () => {
    server.use(
      http.post(`${target.appUrl}/apis/migrate`, () =>
        HttpResponse.json(
          {
            message: JSON.stringify({
              internal: { error: { message: 'Invalid cron expression' } },
            }),
          },
          { status: 400 },
        ),
      ),
    );
    await expect(executeSqlJobChange(target, false, change)).rejects.toThrow(
      'Invalid cron expression',
    );
  });

  it('rejects malformed read responses instead of showing an empty list', async () => {
    server.use(
      http.post(`${target.appUrl}/v2/query`, () =>
        HttpResponse.json({ result: [['data'], ['invalid json']] }),
      ),
    );
    await expect(fetchSqlJobRows(target, 'SELECT data')).rejects.toThrow(
      'invalid SQL Jobs data',
    );
  });
});

describe('SQL Jobs migration contracts', () => {
  it('never embeds environment-specific job IDs in migration writes', () => {
    const create = createSqlJobChange({
      ...sqlJobFixture,
      jobname: sqlJobFixture.jobname!,
    });
    const edit = editSqlJobChange(sqlJobFixture, {
      ...sqlJobFixture,
      jobname: sqlJobFixture.jobname!,
      username: 'another-role',
    });
    const remove = deleteSqlJobChange(sqlJobFixture);
    for (const operation of [create, edit, remove]) {
      expect(operation.up).not.toContain(sqlJobFixture.jobid);
      expect(operation.down).not.toContain(sqlJobFixture.jobid);
      expect(operation.up).toContain('SET LOCAL ROLE postgres');
    }
    expect(edit.up).toContain('postgres');
    expect(edit.down).toContain('another-role');
  });

  it('validates run-history pagination before constructing SQL', () => {
    expect(() => getJobRunsSql('1; DROP TABLE cron.job', 0, 20)).toThrow();
    expect(() => getJobRunsSql('1', -1, 20)).toThrow();
    expect(() => getJobRunsSql('1', 0, 101)).toThrow();
    expect(getJobRunsSql(sqlJobFixture.jobid, 40, 20)).toContain(
      'LIMIT 20 OFFSET 40',
    );
  });
});
