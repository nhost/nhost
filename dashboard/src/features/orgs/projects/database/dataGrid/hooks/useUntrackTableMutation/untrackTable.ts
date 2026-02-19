import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  UntrackTableArgs,
  UntrackTableBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface UntrackTableVariables {
  args: UntrackTableArgs;
}

export default async function untrackTable({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & UntrackTableVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: args.source ?? 'default',
        args: [
          {
            type: 'pg_untrack_table',
            args,
          },
        ],
      } satisfies UntrackTableBulkOperation,
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
