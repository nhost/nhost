import type {
  TrackTableArgs,
  TrackTableStep,
  UntrackTableStep,
} from '@/utils/hasura-api/generated/schemas';
import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface SetTableTrackingMigrationVariables {
  tracked: boolean;
  args: TrackTableArgs;
}

export default async function setTableTrackingMigration({
  adminSecret,
  tracked,
  args,
}: MigrationOperationOptions & SetTableTrackingMigrationVariables) {
  const trackStep: TrackTableStep[] = [{ type: 'pg_track_table', args }];
  const untrackStep: UntrackTableStep[] = [{ type: 'pg_untrack_table', args }];
  const migrationRequest = tracked
    ? {
        name: `add_existing_table_or_view_${args.table.schema}_${args.table.name}`,
        up: trackStep,
        down: untrackStep,
        datasource: args.source ?? 'default',
        skip_execution: false,
      }
    : {
        name: `remove_existing_table_or_view_${args.table.schema}_${args.table.name}`,
        up: untrackStep,
        down: trackStep,
        datasource: args.source ?? 'default',
        skip_execution: false,
      };

  try {
    const response = await executeMigration(migrationRequest, {
      adminSecret,
    });

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
