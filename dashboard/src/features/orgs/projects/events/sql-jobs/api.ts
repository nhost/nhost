import type { AdminApiTarget } from '@/features/orgs/projects/common/hooks/useAdminApiTarget';
import { normalizeQueryError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeQueryError';
import type { SqlJobChange } from '@/features/orgs/projects/events/sql-jobs/types';
import { getHasuraMigrationsApiUrl } from '@/utils/env';

export const SQL_JOBS_QUERY_KEY = 'sql-jobs';
export const SQL_JOBS_DATA_SOURCE = 'default';

function runSql(sql: string, readOnly: boolean) {
  return {
    type: 'run_sql',
    args: {
      source: SQL_JOBS_DATA_SOURCE,
      sql,
      cascade: false,
      read_only: readOnly,
    },
  };
}

export function buildSqlJobMigration(change: SqlJobChange) {
  return {
    name: change.name,
    datasource: SQL_JOBS_DATA_SOURCE,
    skip_execution: false,
    up: [runSql(change.up, false)],
    down: [runSql(change.down, false)],
  };
}

async function request(target: AdminApiTarget, url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-hasura-admin-secret': target.adminSecret,
    },
    body: JSON.stringify(body),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(normalizeQueryError(data));
  }

  return data;
}

export async function fetchSqlJobRows<T>(
  target: AdminApiTarget,
  sql: string,
): Promise<T[]> {
  const data: { result?: string[][] } = await request(
    target,
    `${target.appUrl}/v2/query`,
    runSql(sql, true),
  );

  if (!Array.isArray(data.result)) {
    throw new Error('Postgres returned an invalid SQL Jobs response.');
  }

  try {
    return data.result.slice(1).map(([row]) => JSON.parse(row) as T);
  } catch {
    throw new Error('Postgres returned invalid SQL Jobs data.');
  }
}

export async function executeSqlJobChange(
  target: AdminApiTarget,
  isPlatform: boolean,
  change: SqlJobChange,
): Promise<void> {
  await request(
    target,
    isPlatform ? `${target.appUrl}/v2/query` : getHasuraMigrationsApiUrl(),
    isPlatform ? runSql(change.up, false) : buildSqlJobMigration(change),
  );
}
