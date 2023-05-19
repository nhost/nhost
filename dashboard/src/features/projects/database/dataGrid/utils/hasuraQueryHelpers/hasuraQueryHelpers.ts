import { format } from 'node-pg-format';

export interface HasuraOperation {
  type: 'run_sql';
  args: {
    cascade: boolean;
    read_only: boolean;
    source: string;
    sql: string;
  };
}

/**
 * Returns a message to be used in the down migration if no SQL can be
 * generated.
 */
export function getEmptyDownMigrationMessage(upMigrations: HasuraOperation[]) {
  return `-- Could not auto-generate a down migration\n-- Please write an appropriate down migration for the SQL below:\n${upMigrations
    .map((upMigration) => `-- ${upMigration.args.sql}`)
    .join('\n')}`;
}

/**
 * Prepares an object for Hasura containing an SQL operation. This
 * function uses `node-pg-format`'s `format` function under the hood.
 *
 * @param dataSource - Data source to fetch from
 * @param sqlTemplate - SQL template to use
 * @param args - Additional arguments to pass to the SQL formatter
 * @returns - Prepared Hasura query object
 */
export function getPreparedHasuraQuery(
  dataSource: string,
  sqlTemplate: string,
  ...args: any[]
): HasuraOperation {
  return {
    type: 'run_sql',
    args: {
      cascade: true,
      read_only: false,
      source: dataSource,
      sql: `${format(sqlTemplate, ...args)
        .trim()
        .replace(/\s+/g, ' ')};`,
    },
  };
}

/**
 * Prepares an object for Hasura containing a read-only SQL operation. This
 * function uses `node-pg-format`'s `format` function under the hood.
 *
 * @param dataSource - Data source to fetch from
 * @param sqlTemplate - SQL template to use
 * @param args - Additional arguments to pass to the SQL formatter
 * @returns - Prepared Hasura query object
 */
export function getPreparedReadOnlyHasuraQuery(
  dataSource: string,
  sqlTemplate: string,
  ...args: any[]
): HasuraOperation {
  const preparedHasuraQuery = getPreparedHasuraQuery(
    dataSource,
    sqlTemplate.replace(/\s+/g, ' '),
    ...args,
  );

  return {
    ...preparedHasuraQuery,
    args: {
      ...preparedHasuraQuery.args,
      read_only: true,
    },
  };
}
