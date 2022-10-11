import { logger } from '@/logger';
import axios from 'axios';
import { ENV } from '../env';
import { HasuraMetadataV3 } from './types';

/** Code for the legacy way of applying metadata.
 * This is kept for reference, as it is generic and can be used for other purposes.
 */

interface Table {
  name: string;
  schema: string;
}

interface TableArgs {
  source?: string;
  table: Table;
}

type TableConfig = {
  custom_name?: string;
  identifier?: string;
  custom_root_fields?: {
    select?: string;
    select_by_pk?: string;
    select_aggregate?: string;
    insert?: string;
    insert_one?: string;
    update?: string;
    update_by_pk?: string;
    delete?: string;
    delete_by_pk?: string;
  };
  custom_column_names?: {
    [key: string]: string;
  };
};

type TrackTableArgs = TableArgs & {
  configuration?: TableConfig;
};
type UntrackTableArgs = TableArgs & {
  cascade?: boolean;
};

type TableCustomisationArgs = TableArgs & {
  configuration?: TableConfig;
};

type DropRelationshipArgs = TableArgs & {
  relationship: string;
};

type CreateRelationshipArgs = TableArgs & {
  name: string;
  using: {
    foreign_key_constraint_on:
      | {
          table: Table;
          columns: string[];
        }
      | string[];
  };
};

// Not strongly typed, but is enough to our current needs
type MetadataInconsistency = {
  type: string;
  name: string;
  definition: {
    name: string;
    schema?: string;
    source?: string;
    table?: { schema: string; name: string };
  };
  reason: string;
};

export const runMetadataRequest = async <T>(args: { type: string; args: {} }) =>
  await axios.post<T>(
    ENV.HASURA_GRAPHQL_GRAPHQL_URL.replace('/v1/graphql', '/v1/metadata'),
    args,
    {
      headers: {
        'x-hasura-admin-secret': ENV.HASURA_GRAPHQL_ADMIN_SECRET,
      },
    }
  );

export const exportMetadata = async (): Promise<HasuraMetadataV3> => {
  const { data } = await runMetadataRequest<HasuraMetadataV3>({
    type: 'export_metadata',
    args: {},
  });
  return data;
};

export const replaceMetadata = async (
  metadata: HasuraMetadataV3,
  allowInconsistentMetadata = true
) =>
  runMetadataRequest({
    type: 'replace_metadata',
    args: {
      allow_inconsistent_metadata: allowInconsistentMetadata,
      metadata,
    },
  });

export const dropInconsistentMetadata = async () => {
  try {
    await runMetadataRequest({
      type: 'drop_inconsistent_metadata',
      args: {},
    });
  } catch (error: any) {
    logger.error(error);
    throw new Error(`Error dropping metadata inconsistencies`);
  }
};

// https://hasura.io/docs/latest/graphql/core/api-reference/schema-metadata-api/table-view.html#track-table-v2
export const trackTable = async (args: TrackTableArgs) => {
  try {
    await runMetadataRequest({
      type: 'pg_track_table',
      args,
    });
  } catch (error: any) {
    if (error.response.data.code !== 'already-tracked') {
      logger.error(error);
      throw new Error(`Error tracking table ${args.table.name}`);
    } else {
      logger.debug(`Table ${args.table.name} already tracked`);
    }
  }
};

// https://hasura.io/docs/latest/api-reference/metadata-api/table-view/#metadata-pg-untrack-table
export const untrackTable = async (args: UntrackTableArgs) => {
  try {
    await runMetadataRequest({
      type: 'pg_untrack_table',
      args,
    });
  } catch (error: any) {
    logger.error(error);
    throw new Error(`Error untracking table ${args.table.name}`);
  }
};

type ReloadMetadataResult = {
  message: string;
  is_consistent?: boolean;
  inconsistent_objects?: Array<MetadataInconsistency>;
};

export const reloadMetadata = async (
  args: {
    reload_remote_schemas?: boolean;
    reload_sources?: boolean;
    recreate_event_triggers?: boolean;
  } = {}
): Promise<ReloadMetadataResult> => {
  const { data } = await runMetadataRequest<ReloadMetadataResult>({
    type: 'reload_metadata',
    args,
  });
  return data;
};

export const setTableCustomization = async (args: TableCustomisationArgs) => {
  logger.info(`Set table customization for ${args.table.name}`);

  try {
    await runMetadataRequest({
      type: 'pg_set_table_customization',
      args,
    });
  } catch (error: any) {
    logger.error(error);
    throw new Error('error setting customization for table ' + args.table.name);
  }
};

export const createObjectRelationship = async (
  args: CreateRelationshipArgs
) => {
  logger.info(`Set object relationship ${args.name} for ${args.table.name}`);
  try {
    await runMetadataRequest({
      type: 'pg_create_object_relationship',
      args,
    });
  } catch (error: any) {
    if (error.response.data.code !== 'already-exists') {
      throw new Error(
        `Error creating object relationship for table ${args.table.name}`
      );
    } else {
      logger.debug(
        `Object relationship ${args.name} on table ${args.table.name} is already created`
      );
    }
  }
};

export const createArrayRelationship = async (args: CreateRelationshipArgs) => {
  logger.info(`Create array relationship ${args.name} for ${args.table.name}`);
  try {
    await runMetadataRequest({
      type: 'pg_create_array_relationship',
      args,
    });
  } catch (error: any) {
    if (error.response.data.code !== 'already-exists') {
      throw new Error(
        `Error creating array relationship for table ${args.table.name}`
      );
    }
    logger.debug(
      `Array relationship ${args.name} on table ${args.table.name} is already created`
    );
  }
};

export const dropRelationship = async (args: DropRelationshipArgs) => {
  logger.info(`Drop relationship ${args.relationship} for ${args.table.name}`);
  try {
    await runMetadataRequest({
      type: 'pg_drop_relationship',
      args,
    });
  } catch (error: any) {
    if (error.response.data.code !== 'already-exists') {
      throw new Error(
        `Error dropping relationship for table ${args.table.name}`
      );
    } else {
      logger.debug(
        `Object relationship ${args.relationship} on table ${args.table.name} is already created`
      );
    }
  }
};
