import type { NativeQueryMutationArgs } from '@/features/orgs/projects/database/native-queries/hooks/useNativeQueryMetadataMutation/types';
import type { TrackNativeQueryStep } from '@/utils/hasura-api/generated/schemas';

export default function buildTrackNativeQueryStep(
  source: string,
  args: NativeQueryMutationArgs,
): TrackNativeQueryStep {
  return {
    type: 'pg_track_native_query',
    args: {
      ...args,
      type: 'query',
      arguments: args.arguments ?? {},
      source,
    },
  };
}
