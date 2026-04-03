import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  TrackFunctionArgs,
  TrackFunctionStep,
  UntrackFunctionStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface SetFunctionTrackingMigrationVariables {
  tracked: boolean;
  args: TrackFunctionArgs;
}

export default async function setFunctionTrackingMigration({
  appUrl,
  adminSecret,
  tracked,
  args,
}: MigrationOperationOptions & SetFunctionTrackingMigrationVariables) {
  const trackStep: TrackFunctionStep[] = [{ type: 'pg_track_function', args }];
  const untrackStep: UntrackFunctionStep[] = [
    { type: 'pg_untrack_function', args },
  ];
  const migrationRequest = tracked
    ? {
        name: `add_existing_function_${args.function.schema}_${args.function.name}`,
        up: trackStep,
        down: untrackStep,
        datasource: args.source ?? 'default',
        skip_execution: false,
      }
    : {
        name: `remove_custom_function_${args.function.schema}_${args.function.name}`,
        up: untrackStep,
        down: trackStep,
        datasource: args.source ?? 'default',
        skip_execution: false,
      };

  try {
    const response = await executeMigration(migrationRequest, {
      baseUrl: appUrl,
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
