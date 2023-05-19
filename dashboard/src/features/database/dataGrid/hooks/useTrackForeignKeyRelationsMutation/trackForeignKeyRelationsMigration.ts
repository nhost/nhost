import type {
  AffectedRowsResult,
  ForeignKeyRelation,
  MutationOrQueryBaseOptions,
  QueryError,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { normalizeQueryError } from '@/features/database/dataGrid/utils/normalizeQueryError';
import { getHasuraMigrationsApiUrl } from '@/utils/env';
import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

export interface TrackForeignKeyRelationsMigrationVariables {
  /**
   * Foreign key relation to track.
   */
  foreignKeyRelations: ForeignKeyRelation[];
  /**
   * Schema where the table is located for which the foreign key relation is
   * being tracked.
   */
  schema: string;
  /**
   * Table for which the foreign key relation is being tracked.
   */
  table: string;
}

export interface TrackForeignKeyRelationsMigrationOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function trackForeignKeyRelationsMigration({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  foreignKeyRelations,
}: TrackForeignKeyRelationsMigrationOptions &
  TrackForeignKeyRelationsMigrationVariables) {
  const creatableRelationships = await prepareTrackForeignKeyRelationsMetadata({
    dataSource,
    schema,
    table,
    appUrl,
    adminSecret,
    foreignKeyRelations,
  });

  const response = await fetch(`${getHasuraMigrationsApiUrl()}/apis/migrate`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },

    body: JSON.stringify({
      dataSource,
      skip_execution: false,
      name: `track_foreign_key_relations_${schema}_${table}`,
      down: [],
      up: creatableRelationships,
    }),
  });

  const responseData: [AffectedRowsResult, QueryResult<string[]>] | QueryError =
    await response.json();

  if (response.ok) {
    return;
  }

  const normalizedError = normalizeQueryError(responseData);

  throw new Error(normalizedError);
}
