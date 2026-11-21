import { execFileSync } from 'node:child_process';
import {
  CRON_STATE_SQL,
  createSqlJobChange,
  deleteSqlJobChange,
  disableCronChange,
  editSqlJobChange,
  getJobRunsSql,
  SQL_JOBS_SQL,
  setSqlJobActiveChange,
} from '@/features/orgs/projects/events/sql-jobs/sql';
import { sqlJobFixture } from '@/features/orgs/projects/events/sql-jobs/test-fixtures';
import type { SqlJob } from '@/features/orgs/projects/events/sql-jobs/types';

// Opt in with a disposable Nhost Postgres container whose scheduler database
// is postgres and whose cron.launch_active_jobs is off. Never use a project DB.
const container = process.env.PGCRON_TEST_CONTAINER;

function sql(statements: string) {
  return execFileSync(
    'docker',
    [
      'exec',
      '-i',
      container!,
      'psql',
      '-X',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-At',
      '-v',
      'ON_ERROR_STOP=1',
    ],
    {
      input: `BEGIN;\n${assertSql("current_setting('cron.launch_active_jobs') = 'off'")}\nCREATE EXTENSION pg_cron;\n${statements}\nROLLBACK;`,
      encoding: 'utf8',
    },
  );
}

function assertSql(condition: string) {
  return `DO $$ BEGIN IF NOT (${condition}) THEN RAISE EXCEPTION 'Assertion failed'; END IF; END $$;`;
}

(container ? describe : describe.skip)('SQL Jobs against real pg_cron', () => {
  it('reads scheduler state, jobs, and run history before any job exists', () => {
    const result = sql(
      `${CRON_STATE_SQL}\n${SQL_JOBS_SQL}\n${getJobRunsSql('1', 0, 20)}`,
    );
    expect(result).toContain('"schedulerDatabase" : "postgres"');
  });

  it('creates, edits, disables, deletes and rolls back without replaying numeric IDs', () => {
    const job = { ...sqlJobFixture, jobid: '99999' };
    const create = createSqlJobChange({ ...job, jobname: job.jobname! });
    const edit = editSqlJobChange(job, {
      ...job,
      jobname: job.jobname!,
      schedule: '5 seconds',
      command: "SELECT 'hello';\nSELECT $$body$$;",
    });
    const toggle = setSqlJobActiveChange(job);
    const remove = deleteSqlJobChange(job);
    const output = sql(`
      ${create.up}
      ${assertSql('(SELECT count(*) FROM cron.job) = 1')}
      ${SQL_JOBS_SQL}
      ${edit.up}
      ${assertSql("(SELECT schedule FROM cron.job) = '5 seconds'")}
      ${edit.down}
      ${toggle.up}
      ${assertSql('(SELECT active FROM cron.job) = false')}
      ${toggle.down}
      ${assertSql('(SELECT active FROM cron.job) = true')}
      ${remove.up}
      ${assertSql('(SELECT count(*) FROM cron.job) = 0')}
      ${remove.down}
      ${assertSql('(SELECT count(*) FROM cron.job) = 1')}
      ${create.down}
      ${assertSql('(SELECT count(*) FROM cron.job) = 0')}
    `);
    expect(output).toContain('refresh-summary');
  });

  it('does not execute scheduled commands, even with quotes, dollar delimiters, and backslashes', () => {
    const command =
      "SELECT 'quoted';\nDO $$BEGIN RAISE EXCEPTION 'must not run'; END$$;\n-- \\ backslash";
    const jobname = "job'); DROP SCHEMA public CASCADE; --";
    const create = createSqlJobChange({
      ...sqlJobFixture,
      jobname,
      command,
      active: false,
    });
    const output = sql(
      `${create.up}\nSELECT command FROM cron.job;\n${create.down}`,
    );
    expect(output).toContain(command);
  });

  it('rejects duplicate names instead of silently overwriting a job', () => {
    const change = createSqlJobChange({
      ...sqlJobFixture,
      jobname: sqlJobFixture.jobname!,
    });
    expect(() => sql(`${change.up}\n${change.up}`)).toThrow();
  });

  it('supports legacy unnamed jobs and restores connection parameters on rollback', () => {
    const unnamed: SqlJob = {
      ...sqlJobFixture,
      jobname: null,
      nodename: '/tmp',
      active: false,
    };
    const remove = deleteSqlJobChange(unnamed);
    const toggle = setSqlJobActiveChange(unnamed);
    sql(`
      ${remove.down}
      ${assertSql("(SELECT nodename FROM cron.job) = '/tmp'")}
      ${toggle.up}
      ${assertSql('(SELECT active FROM cron.job) = true')}
      ${toggle.down}
      ${remove.up}
      ${assertSql('(SELECT count(*) FROM cron.job) = 0')}
    `);
  });

  it('restores named and unnamed definitions after disabling the extension', () => {
    const unnamed = {
      ...sqlJobFixture,
      jobname: null,
      command: 'SELECT 10',
      active: false,
    };
    const disable = disableCronChange([sqlJobFixture, unnamed]);
    sql(`
      ${createSqlJobChange({ ...sqlJobFixture, jobname: sqlJobFixture.jobname! }).up}
      ${deleteSqlJobChange(unnamed).down}
      ${disable.up}
      ${assertSql("NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron')")}
      ${disable.down}
      ${assertSql('(SELECT count(*) FROM cron.job) = 2')}
      ${assertSql('(SELECT count(*) FROM cron.job WHERE NOT active) = 1')}
    `);
  });

  (process.env.PGCRON_TEST_HASURA ? it : it.skip)(
    'reads and writes through a real Hasura run_sql endpoint',
    () => {
      function query(statement: string, readOnly = false) {
        const response = execFileSync(
          'docker',
          [
            'exec',
            container!,
            'wget',
            '-qO-',
            '--header',
            'Content-Type: application/json',
            '--header',
            'x-hasura-admin-secret: pgcron-test-only',
            '--post-data',
            JSON.stringify({
              type: 'run_sql',
              args: {
                source: 'default',
                sql: statement,
                read_only: readOnly,
                cascade: false,
              },
            }),
            'http://127.0.0.1:8080/v2/query',
          ],
          { encoding: 'utf8' },
        );
        return JSON.parse(response) as {
          result_type: string;
          result: string[][];
        };
      }
      const change = createSqlJobChange({
        ...sqlJobFixture,
        jobname: sqlJobFixture.jobname!,
        active: false,
      });
      query('CREATE EXTENSION pg_cron;');
      try {
        expect(query(CRON_STATE_SQL, true).result_type).toBe('TuplesOk');
        query(change.up);
        const jobs = query(SQL_JOBS_SQL, true);
        expect(JSON.parse(jobs.result[1][0]).jobname).toBe(
          sqlJobFixture.jobname,
        );
        query(change.down);
        expect(query(SQL_JOBS_SQL, true).result).toHaveLength(1);
      } finally {
        query('DROP EXTENSION pg_cron;');
      }
    },
  );

  it('fails closed when an unnamed definition matches multiple jobs', () => {
    const unnamed = { ...sqlJobFixture, jobname: null };
    const remove = deleteSqlJobChange(unnamed);
    expect(() => sql(`${remove.down}\n${remove.down}\n${remove.up}`)).toThrow();
  });
});
