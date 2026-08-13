import type { NativeQueryFormValues } from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import type {
  NativeQueryItem,
  NativeQueryMetadataBulkOperation,
  TrackNativeQueryArgs,
  TrackNativeQueryStep,
  UntrackNativeQueryStep,
} from '@/utils/hasura-api/generated/schemas';

export const buildTrackNativeQueryStep = (
  args: TrackNativeQueryArgs,
): TrackNativeQueryStep => ({
  type: 'pg_track_native_query',
  args: {
    ...args,
    source: 'default',
    type: 'query',
    arguments: args.arguments ?? {},
  },
});

export const buildUntrackNativeQueryStep = (
  rootFieldName: string,
): UntrackNativeQueryStep => ({
  type: 'pg_untrack_native_query',
  args: { source: 'default', root_field_name: rootFieldName },
});

export const nativeQueryToFormValues = (
  query: NativeQueryItem,
): NativeQueryFormValues => ({
  source: 'default',
  rootFieldName: query.root_field_name,
  description: query.comment ?? '',
  returns: query.returns,
  code: query.code,
  arguments: Object.entries(query.arguments ?? {}).map(([name, argument]) => ({
    name,
    type: argument.type,
    nullable: argument.nullable ?? false,
    description: argument.description ?? '',
  })),
});

export const buildEditNativeQuerySteps = (
  args: TrackNativeQueryArgs,
  original: NativeQueryItem,
): NativeQueryMetadataBulkOperation['args'] => [
  buildUntrackNativeQueryStep(original.root_field_name),
  buildTrackNativeQueryStep(args),
];
