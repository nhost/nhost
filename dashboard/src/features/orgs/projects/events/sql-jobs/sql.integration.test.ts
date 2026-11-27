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
import { sqlJobFixture as baseSqlJobFixture } from '@/features/orgs/projects/events/sql-jobs/test-fixtures';
import type {
  SqlJob,
  SqlJobRun,
} from '@/features/orgs/projects/events/sql-jobs/types';

// Opt in with a disposable Nhost Postgres container whose scheduler database
// is postgres and whose cron.launch_active_jobs is off. Never use a project DB.
const container = process.env.PGCRON_TEST_CONTAINER;
const sourceDatabase = 'local';
const sqlJobFixture = { ...baseSqlJobFixture, database: sourceDatabase };

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
  return `DO $$ BEGIN IF (${condition}) IS NOT TRUE THEN RAISE EXCEPTION 'Assertion failed'; END IF; END $$;`;
}

(container ? describe : describe.skip)('SQL Jobs against real pg_cron', () => {
  it('reads scheduler state, jobs, and run history before any job exists', () => {
    const result = sql(
      `${CRON_STATE_SQL}\n${SQL_JOBS_SQL}\n${getJobRunsSql('1', 0, 20)}`,
    );
    expect(result).toContain('"schedulerDatabase" : "postgres"');
  });

  it('orders run history by newest start, with numeric IDs breaking ties across pages', () => {
    const output = sql(`
      INSERT INTO cron.job_run_details (jobid, runid, status, start_time, command)
      VALUES
        (1, 9, 'succeeded', '2026-01-01T10:03:00Z', 'SELECT 1'),
        (1, 10, 'succeeded', '2026-01-01T10:02:00Z', 'SELECT 1'),
        (1, 99, 'succeeded', '2026-01-01T10:02:00Z', 'SELECT 1'),
        (1, 100, 'succeeded', '2026-01-01T10:02:00Z', 'SELECT 1'),
        (1, 9007199254740992, 'succeeded', '2026-01-01T10:01:00Z', 'SELECT 1'),
        (1, 9007199254740993, 'succeeded', '2026-01-01T10:01:00Z', 'SELECT 1'),
        (1, 999, 'starting', NULL, 'SELECT 1'),
        (1, 1000, 'starting', NULL, 'SELECT 1'),
        (2, 9007199254740994, 'succeeded', '2026-01-01T10:04:00Z', 'SELECT 1');
      ${getJobRunsSql('1', 0, 4)}
      ${getJobRunsSql('1', 4, 4)}
    `);
    const runIds = output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => (JSON.parse(line) as SqlJobRun).runid);

    expect(runIds).toEqual([
      '9',
      '100',
      '99',
      '10',
      '9007199254740993',
      '9007199254740992',
      '1000',
      '999',
    ]);
  });

  it("selects each job's latest run using numeric rather than text IDs", () => {
    const output = sql(`
      SELECT cron.schedule('first-job', '0 * * * *', 'SELECT 1');
      SELECT cron.schedule('second-job', '0 * * * *', 'SELECT 2');
      INSERT INTO cron.job_run_details (jobid, runid, status, start_time, command)
      VALUES
        (1, 9, 'failed', '2026-01-01T10:00:00Z', 'SELECT 1'),
        (1, 10, 'succeeded', '2026-01-01T11:00:00Z', 'SELECT 1'),
        (2, 99, 'succeeded', '2026-01-01T10:00:00Z', 'SELECT 2'),
        (2, 100, 'failed', '2026-01-01T11:00:00Z', 'SELECT 2');
      ${SQL_JOBS_SQL}
    `);
    const jobs = output
      .split('\n')
      .filter((line) => line.startsWith('{'))
      .map((line) => JSON.parse(line) as SqlJob);

    expect(jobs).toMatchObject([
      { jobname: 'second-job', lastRun: { runid: '100', status: 'failed' } },
      { jobname: 'first-job', lastRun: { runid: '10', status: 'succeeded' } },
    ]);
  });

  it('creates, edits, disables, deletes and rolls back without replaying numeric IDs', () => {
    const job = { ...sqlJobFixture, jobid: '99999' };
    const create = createSqlJobChange(
      { ...job, jobname: job.jobname! },
      sourceDatabase,
    );
    const edit = editSqlJobChange(
      job,
      {
        ...job,
        jobname: job.jobname!,
        schedule: '5 seconds',
        command: "SELECT 'hello';\nSELECT $$body$$;",
      },
      sourceDatabase,
    );
    const toggle = setSqlJobActiveChange(job, sourceDatabase);
    const remove = deleteSqlJobChange(job, sourceDatabase);
    const inCurrentDatabase = assertSql(
      '(SELECT bool_and(database = current_database()) FROM cron.job)',
    );
    const output = sql(`
      ${assertSql("NOT EXISTS (SELECT FROM pg_database WHERE datname = 'local')")}
      ${create.up}
      ${assertSql('(SELECT count(*) FROM cron.job) = 1')}
      ${inCurrentDatabase}
      ${SQL_JOBS_SQL}
      ${edit.up}
      ${assertSql("(SELECT schedule FROM cron.job) = '5 seconds'")}
      ${inCurrentDatabase}
      ${edit.down}
      ${inCurrentDatabase}
      ${toggle.up}
      ${inCurrentDatabase}
      ${assertSql('(SELECT active FROM cron.job) = false')}
      ${toggle.down}
      ${inCurrentDatabase}
      ${assertSql('(SELECT active FROM cron.job) = true')}
      ${remove.up}
      ${assertSql('(SELECT count(*) FROM cron.job) = 0')}
      ${remove.down}
      ${inCurrentDatabase}
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
    const create = createSqlJobChange(
      {
        ...sqlJobFixture,
        jobname,
        command,
        active: false,
      },
      sourceDatabase,
    );
    const output = sql(
      `${create.up}\nSELECT command FROM cron.job;\n${create.down}`,
    );
    expect(output).toContain(command);
  });

  it('rejects duplicate names instead of silently overwriting a job', () => {
    const change = createSqlJobChange(
      {
        ...sqlJobFixture,
        jobname: sqlJobFixture.jobname!,
      },
      sourceDatabase,
    );
    expect(() => sql(`${change.up}\n${change.up}`)).toThrow();
  });

  it('supports legacy unnamed jobs and restores connection parameters on rollback', () => {
    const unnamed: SqlJob = {
      ...sqlJobFixture,
      jobname: null,
      nodename: '/tmp',
      active: false,
    };
    const remove = deleteSqlJobChange(unnamed, sourceDatabase);
    const toggle = setSqlJobActiveChange(unnamed, sourceDatabase);
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
    const disable = disableCronChange([sqlJobFixture, unnamed], sourceDatabase);
    sql(`
      ${createSqlJobChange({ ...sqlJobFixture, jobname: sqlJobFixture.jobname! }, sourceDatabase).up}
      ${deleteSqlJobChange(unnamed, sourceDatabase).down}
      ${disable.up}
      ${assertSql("NOT EXISTS (SELECT FROM pg_extension WHERE extname = 'pg_cron')")}
      ${disable.down}
      ${assertSql('(SELECT count(*) FROM cron.job) = 2')}
      ${assertSql('(SELECT bool_and(database = current_database()) FROM cron.job)')}
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
      const change = createSqlJobChange(
        {
          ...sqlJobFixture,
          jobname: sqlJobFixture.jobname!,
          active: false,
        },
        sourceDatabase,
      );
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

  it.each(['named', 'unnamed'])(
    'preserves an explicit cross-database target for %s jobs through changes and rollback',
    (kind) => {
      const job = {
        ...sqlJobFixture,
        jobname: kind === 'named' ? 'cross-database-job' : null,
        database: 'template1',
      };
      const remove = deleteSqlJobChange(job, sourceDatabase);
      const edit = editSqlJobChange(
        job,
        { ...job, jobname: job.jobname ?? '', schedule: '5 seconds' },
        sourceDatabase,
      );
      const toggle = setSqlJobActiveChange(job, sourceDatabase);
      const disable = disableCronChange([job], sourceDatabase);
      const inTargetDatabase = assertSql(
        "(SELECT database FROM cron.job) = 'template1'",
      );
      sql(`
        ${remove.down}
        ${inTargetDatabase}
        ${edit.up}
        ${inTargetDatabase}
        ${edit.down}
        ${inTargetDatabase}
        ${toggle.up}
        ${inTargetDatabase}
        ${toggle.down}
        ${inTargetDatabase}
        ${remove.up}
        ${assertSql('(SELECT count(*) FROM cron.job) = 0')}
        ${remove.down}
        ${inTargetDatabase}
        ${disable.up}
        ${disable.down}
        ${inTargetDatabase}
        ${remove.up}
      `);
    },
  );

  it('fails closed when an unnamed definition matches multiple jobs', () => {
    const unnamed = { ...sqlJobFixture, jobname: null };
    const remove = deleteSqlJobChange(unnamed, sourceDatabase);
    expect(() => sql(`${remove.down}\n${remove.down}\n${remove.up}`)).toThrow();
  });
});
