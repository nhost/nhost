import type {
  TrackTableBulkOperation,
  TrackTableStep,
  UntrackTableBulkOperation,
  UntrackTableStep,
  TrackFunctionBulkOperation,
  TrackFunctionStep,
  UntrackFunctionBulkOperation,
  UntrackFunctionStep,
} from '@/utils/hasura-api/generated/schemas';

export interface BuildTrackingOperationParams {
  isFunction: boolean;
  tracked: boolean;
  resourceVersion: number;
  source: string;
  schema: string;
  name: string;
}

export type TrackingOperation =
  | TrackTableBulkOperation
  | UntrackTableBulkOperation
  | TrackFunctionBulkOperation
  | UntrackFunctionBulkOperation;

export default function buildTrackingOperation({
  isFunction,
  tracked,
  resourceVersion,
  source,
  schema,
  name,
}: BuildTrackingOperationParams): TrackingOperation {
  if (!isFunction) {
    const tableArgs = { source, table: { name, schema } };
    const trackStep: TrackTableStep[] = [
      { type: 'pg_track_table', args: tableArgs },
    ];
    const untrackStep: UntrackTableStep[] = [
      { type: 'pg_untrack_table', args: tableArgs },
    ];

    return tracked
      ? ({
          type: 'bulk',
          source,
          resource_version: resourceVersion,
          args: trackStep,
        } satisfies TrackTableBulkOperation)
      : ({
          type: 'bulk',
          source,
          resource_version: resourceVersion,
          args: untrackStep,
        } satisfies UntrackTableBulkOperation);
  }

  const functionArgs = { source, function: { name, schema } };
  const trackStep: TrackFunctionStep[] = [
    { type: 'pg_track_function', args: functionArgs },
  ];
  const untrackStep: UntrackFunctionStep[] = [
    { type: 'pg_untrack_function', args: functionArgs },
  ];

  return tracked
    ? ({
        type: 'bulk',
        source,
        resource_version: resourceVersion,
        args: trackStep,
      } satisfies TrackFunctionBulkOperation)
    : ({
        type: 'bulk',
        source,
        resource_version: resourceVersion,
        args: untrackStep,
      } satisfies UntrackFunctionBulkOperation);
}
