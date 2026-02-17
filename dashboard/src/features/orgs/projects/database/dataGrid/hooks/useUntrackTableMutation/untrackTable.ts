import type {
  AffectedRowsResult,
  MetadataError,
  MutationOrQueryBaseOptions,
  QueryResult,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { normalizeMetadataError } from '@/features/orgs/projects/database/dataGrid/utils/normalizeMetadataError';

export interface UntrackTableVariables {
  /**
   * Table to untrack.
   */
  table: { name: string };
}

export interface UntrackTableOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function untrackTable({
  dataSource,
  schema,
  appUrl,
  adminSecret,
  table,
}: UntrackTableOptions & UntrackTableVariables) {
  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        {
          args: {
            source: dataSource,
            table: { schema, name: table.name },
            cascade: true,
          },
          type: 'pg_untrack_table',
        },
      ],
      type: 'bulk',
      source: dataSource,
      version: 1,
    }),
  });

  const responseData:
    | [AffectedRowsResult, QueryResult<string[]>]
    | MetadataError = await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeMetadataError(responseData);

  throw new Error(normalizedError);
}
