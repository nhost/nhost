import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  TrackFunctionArgs,
  TrackFunctionBulkOperation,
  TrackFunctionStep,
  UntrackFunctionBulkOperation,
  UntrackFunctionStep,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface SetFunctionTrackingVariables {
  tracked: boolean;
  resourceVersion: number;
  args: TrackFunctionArgs;
}

export default async function setFunctionTracking({
  appUrl,
  adminSecret,
  tracked,
  resourceVersion,
  args,
}: MetadataOperationOptions & SetFunctionTrackingVariables) {
  const trackOperation: TrackFunctionStep[] = [
    { type: 'pg_track_function', args },
  ];
  const untrackOperation: UntrackFunctionStep[] = [
    { type: 'pg_untrack_function', args },
  ];
  const operation = tracked
    ? ({
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: trackOperation,
      } satisfies TrackFunctionBulkOperation)
    : ({
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: untrackOperation,
      } satisfies UntrackFunctionBulkOperation);

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
