import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  TrackTableArgs,
  TrackTableBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface TrackTableVariables {
  resourceVersion: number;
  args: TrackTableArgs;
}

export default async function trackTable({
  appUrl,
  adminSecret,
  resourceVersion,
  args,
}: MetadataOperationOptions & TrackTableVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_track_table',
            args,
          },
        ],
      } satisfies TrackTableBulkOperation,
      {
        baseUrl: appUrl,
        adminSecret,
      },
    );

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
