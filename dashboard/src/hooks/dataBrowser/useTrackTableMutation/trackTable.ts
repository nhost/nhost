import type {
  AffectedRowsResult,
  DatabaseTable,
  MetadataError,
  MutationOrQueryBaseOptions,
  QueryResult,
} from '@/types/dataBrowser';

export interface TrackTableVariables {
  /**
   * Table to track.
   */
  table: DatabaseTable;
}

export interface TrackTableOptions
  extends Omit<MutationOrQueryBaseOptions, 'table'> {}

export default async function trackTable({
  dataSource,
  schema,
  appUrl,
  adminSecret,
  table,
}: TrackTableOptions & TrackTableVariables) {
  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: [
        {
          args: { source: dataSource, table: { schema, name: table.name } },
          type: 'pg_track_table',
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

  if (!response.ok || 'error' in responseData) {
    if ('internal' in responseData) {
      const metadataError = responseData as MetadataError;
      throw new Error(
        metadataError.internal[0]?.reason ||
          'Unknown error occurred. Please try again later.',
      );
    }

    if ('error' in responseData) {
      const metadataError = responseData as MetadataError;
      throw new Error(metadataError.error);
    }
  }
}
