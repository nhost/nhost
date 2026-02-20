import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  TrackTableArgs,
  TrackTableBulkOperation,
  TrackTableStep,
  UntrackTableBulkOperation,
  UntrackTableStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetTableTrackingVariables {
  tracked: boolean;
  resourceVersion: number;
  args: TrackTableArgs;
}

export default async function setTableTracking({
  appUrl,
  adminSecret,
  tracked,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetTableTrackingVariables) {
  const trackOperation: TrackTableStep[] = [{ type: 'pg_track_table', args }];
  const untrackOperation: UntrackTableStep[] = [
    { type: 'pg_untrack_table', args },
  ];
  const operation = tracked
    ? ({
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: trackOperation,
      } satisfies TrackTableBulkOperation)
    : ({
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: untrackOperation,
      } satisfies UntrackTableBulkOperation);

  try {
    const response = await metadataOperation(operation, {
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
