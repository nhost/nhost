import { format } from 'node-pg-format';
import { getInstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getInstallExtensionSQL';
import { getUninstallExtensionSQL } from '@/features/orgs/projects/database/extensions/utils/getUninstallExtensionSQL';
import { withPostgresRole } from '@/features/orgs/projects/database/extensions/utils/withPostgresRole';
import type {
  SqlJob,
  SqlJobChange,
  SqlJobValues,
} from '@/features/orgs/projects/events/sql-jobs/types';

export const CRON_STATE_SQL = withPostgresRole(`SELECT json_build_object(
  'database', current_database(),
  'schedulerDatabase', current_setting('cron.database_name', true),
  'settings', COALESCE((SELECT json_agg(s ORDER BY s.name) FROM (
    SELECT name, setting, context, pending_restart, short_desc, min_val, max_val
    FROM pg_settings WHERE name LIKE 'cron.%'
  ) s), '[]'::json)
) AS data`);

export const SQL_JOBS_SQL =
  withPostgresRole(`SELECT row_to_json(j) AS data FROM (
  SELECT job.jobid::text, job.jobname, job.schedule, job.command,
    job.database, job.username, job.active, job.nodename, job.nodeport,
    (SELECT row_to_json(r) FROM (
      SELECT runid::text, jobid::text, status, return_message,
        start_time, end_time, command
      FROM cron.job_run_details AS runs WHERE runs.jobid = job.jobid
      ORDER BY runs.runid DESC LIMIT 1
    ) r) AS "lastRun"
  FROM cron.job job ORDER BY job.jobid DESC
) j`);

export type SqlJobRunFilter = 'all' | 'succeeded' | 'failed' | 'running';

const RUN_FILTER_SQL: Record<SqlJobRunFilter, string> = {
  all: '',
  succeeded: " AND runs.status = 'succeeded'",
  failed: " AND runs.status = 'failed'",
  running: " AND runs.status NOT IN ('succeeded', 'failed')",
};

export function getJobRunsSql(
  jobid: string,
  offset: number,
  limit: number,
  filter: SqlJobRunFilter = 'all',
) {
  if (!/^\d+$/.test(jobid) || !Number.isSafeInteger(offset) || offset < 0) {
    throw new Error('Invalid job history request.');
  }

  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('Invalid job history page size.');
  }

  return withPostgresRole(
    format(
      `SELECT row_to_json(r) AS data FROM (
    SELECT runid::text, jobid::text, status, return_message,
      start_time, end_time, command
    FROM cron.job_run_details AS runs WHERE runs.jobid = %L::bigint%s
    ORDER BY runs.start_time DESC NULLS LAST, runs.runid DESC LIMIT %s OFFSET %s
  ) r`,
      jobid,
      RUN_FILTER_SQL[filter],
      limit,
      offset,
    ),
  );
}

export function getJobRunCountsSql(jobid: string) {
  if (!/^\d+$/.test(jobid)) {
    throw new Error('Invalid job history request.');
  }

  return withPostgresRole(
    format(
      `SELECT row_to_json(r) AS data FROM (
    SELECT count(*)::int AS "all",
      count(*) FILTER (WHERE status = 'succeeded')::int AS succeeded,
      count(*) FILTER (WHERE status = 'failed')::int AS failed,
      count(*) FILTER (WHERE status NOT IN ('succeeded', 'failed'))::int AS running
    FROM cron.job_run_details WHERE jobid = %L::bigint
  ) r`,
      jobid,
    ),
  );
}

function jobDatabaseSql(database: string, currentDatabase: string): string {
  return database === currentDatabase
    ? 'current_database()'
    : format('%L', database);
}

// IDs differ when migrations replay on another database. Named jobs have a
// stable (name, role) key; legacy unnamed jobs must match their old definition.
function jobPredicate(job: SqlJob, currentDatabase: string): string {
  if (job.jobname !== null) {
    return format('jobname = %L AND username = %L', job.jobname, job.username);
  }

  return format(
    'jobname IS NULL AND username = %L AND database = %s AND schedule = %L AND command = %L AND nodename = %L AND nodeport = %L',
    job.username,
    jobDatabaseSql(job.database, currentDatabase),
    job.schedule,
    job.command,
    job.nodename,
    job.nodeport,
  );
}

function block(body: string): string {
  return withPostgresRole(format('DO %L', `${body};`));
}

function createJobSql(
  job: SqlJobValues | SqlJob,
  currentDatabase: string,
): string {
  const database = jobDatabaseSql(job.database, currentDatabase);
  const schedule =
    job.jobname === null
      ? format('cron.schedule(%L, %L)', job.schedule, job.command)
      : format(
          'cron.schedule_in_database(%L, %L, %L, %s, %L, %L)',
          job.jobname,
          job.schedule,
          job.command,
          database,
          job.username,
          job.active,
        );
  const guard =
    job.jobname === null
      ? ''
      : format(
          `
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = %L AND username = %L) THEN
      RAISE EXCEPTION 'A SQL job with this name and database role already exists.';
    END IF;`,
          job.jobname,
          job.username,
        );
  const restoreConnection =
    'nodename' in job
      ? format(
          'UPDATE cron.job SET nodename = %L, nodeport = %L WHERE jobid = target_job_id;',
          job.nodename,
          job.nodeport,
        )
      : '';

  return block(`DECLARE target_job_id bigint;
BEGIN
  ${guard}
  SELECT ${schedule} INTO target_job_id;
  PERFORM cron.alter_job(target_job_id, database := ${database},
    username := ${format('%L', job.username)}, active := ${format('%L', job.active)});
  ${restoreConnection}
END`);
}

function deleteJobSql(job: SqlJob, currentDatabase: string): string {
  return block(`DECLARE target_job_id bigint;
BEGIN
  SELECT jobid INTO STRICT target_job_id FROM cron.job WHERE ${jobPredicate(job, currentDatabase)};
  PERFORM cron.unschedule(target_job_id);
END`);
}

function alterJobSql(
  before: SqlJob,
  after: SqlJobValues | SqlJob,
  currentDatabase: string,
): string {
  return block(
    format(
      `DECLARE target_job_id bigint;
BEGIN
  SELECT jobid INTO STRICT target_job_id FROM cron.job WHERE %s;
  PERFORM cron.alter_job(target_job_id, schedule := %L, command := %L,
    database := %s, username := %L, active := %L);
END`,
      jobPredicate(before, currentDatabase),
      after.schedule,
      after.command,
      jobDatabaseSql(after.database, currentDatabase),
      after.username,
      after.active,
    ),
  );
}

function migrationName(action: string, name: string | null): string {
  return `${action}_sql_job_${(name ?? 'unnamed').replace(/[^a-zA-Z0-9]/g, '_')}`;
}

export function createSqlJobChange(
  values: SqlJobValues,
  currentDatabase: string,
): SqlJobChange {
  const job: SqlJob = {
    ...values,
    jobid: '',
    nodename: '',
    nodeport: 0,
    lastRun: null,
  };
  return {
    name: migrationName('create', values.jobname),
    up: createJobSql(values, currentDatabase),
    down: deleteJobSql(job, currentDatabase),
  };
}

export function editSqlJobChange(
  before: SqlJob,
  values: SqlJobValues,
  currentDatabase: string,
): SqlJobChange {
  const after = { ...before, ...values, jobname: before.jobname };
  return {
    name: migrationName('update', before.jobname),
    up: alterJobSql(before, after, currentDatabase),
    down: alterJobSql(after, before, currentDatabase),
  };
}

export function deleteSqlJobChange(
  job: SqlJob,
  currentDatabase: string,
): SqlJobChange {
  return {
    name: migrationName('delete', job.jobname),
    up: deleteJobSql(job, currentDatabase),
    down: createJobSql(job, currentDatabase),
  };
}

export function disableCronChange(
  jobs: SqlJob[],
  currentDatabase: string,
): SqlJobChange {
  return {
    name: 'disable_extension_pg_cron',
    up: getUninstallExtensionSQL('pg_cron'),
    down: [
      getInstallExtensionSQL('pg_cron'),
      ...jobs.map((job) => createJobSql(job, currentDatabase)),
    ].join('\n'),
  };
}

export function setSqlJobActiveChange(
  job: SqlJob,
  currentDatabase: string,
): SqlJobChange {
  return editSqlJobChange(
    job,
    {
      ...job,
      jobname: job.jobname ?? '',
      active: !job.active,
    },
    currentDatabase,
  );
}
