import buildNativeQueryTrackArgs, {
  type NativeQueryFormValues,
} from '@/features/orgs/projects/database/native-queries/utils/buildNativeQueryTrackArgs';
import type {
  NativeQueryItem,
  NativeQueryMetadataBulkOperation,
  TrackNativeQueryArgs,
  TrackNativeQueryStep,
  UntrackNativeQueryStep,
} from '@/utils/hasura-api/generated/schemas';

export type NativeQueryStep = NativeQueryMetadataBulkOperation['args'][number];

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
  rootFieldName: query.root_field_name,
  returns: query.returns,
  code: query.code,
  arguments: Object.entries(query.arguments ?? {}).map(([name, argument]) => ({
    name,
    type: argument.type,
    nullable: argument.nullable ?? false,
    description: argument.description ?? '',
  })),
});

export interface NativeQueryMigration {
  name: string;
  up: NativeQueryStep[];
  down: NativeQueryStep[];
  datasource: 'default';
  skip_execution: false;
}

export const buildCreateNativeQueryMigration = (
  args: TrackNativeQueryArgs,
): NativeQueryMigration => ({
  name: `create_native_query_${args.root_field_name}`,
  up: [buildTrackNativeQueryStep(args)],
  down: [buildUntrackNativeQueryStep(args.root_field_name)],
  datasource: 'default',
  skip_execution: false,
});

export const buildEditNativeQuerySteps = (
  args: TrackNativeQueryArgs,
  original: NativeQueryItem,
): NativeQueryStep[] => [
  buildUntrackNativeQueryStep(original.root_field_name),
  buildTrackNativeQueryStep(args),
];

export const buildEditNativeQueryMigration = (
  args: TrackNativeQueryArgs,
  original: NativeQueryItem,
): NativeQueryMigration => ({
  name: `update_native_query_${original.root_field_name}`,
  up: buildEditNativeQuerySteps(args, original),
  down: [
    buildUntrackNativeQueryStep(args.root_field_name),
    buildTrackNativeQueryStep(
      buildNativeQueryTrackArgs(nativeQueryToFormValues(original), original),
    ),
  ],
  datasource: 'default',
  skip_execution: false,
});

export const buildDeleteNativeQueryMigration = (
  original: NativeQueryItem,
): NativeQueryMigration => ({
  name: `delete_native_query_${original.root_field_name}`,
  up: [buildUntrackNativeQueryStep(original.root_field_name)],
  down: [
    buildTrackNativeQueryStep(
      buildNativeQueryTrackArgs(nativeQueryToFormValues(original), original),
    ),
  ],
  datasource: 'default',
  skip_execution: false,
});
