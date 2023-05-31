import type {
  AffectedRowsResult,
  ForeignKeyRelation,
  MetadataError,
  MutationOrQueryBaseOptions,
  QueryResult,
} from '@/features/database/dataGrid/types/dataBrowser';
import { normalizeMetadataError } from '@/features/database/dataGrid/utils/normalizeMetadataError';
import prepareTrackForeignKeyRelationsMetadata from './prepareTrackForeignKeyRelationsMetadata';

export interface TrackForeignKeyRelationsVariables {
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

export interface TrackForeignKeyRelationsOptions
  extends Omit<MutationOrQueryBaseOptions, 'schema' | 'table'> {}

export default async function trackForeignKeyRelations({
  dataSource,
  schema,
  table,
  appUrl,
  adminSecret,
  foreignKeyRelations,
}: TrackForeignKeyRelationsOptions & TrackForeignKeyRelationsVariables) {
  const creatableRelationships = await prepareTrackForeignKeyRelationsMetadata({
    dataSource,
    schema,
    table,
    appUrl,
    adminSecret,
    foreignKeyRelations,
  });

  const response = await fetch(`${appUrl}/v1/metadata`, {
    method: 'POST',
    headers: {
      'x-hasura-admin-secret': adminSecret,
    },
    body: JSON.stringify({
      args: creatableRelationships,
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
