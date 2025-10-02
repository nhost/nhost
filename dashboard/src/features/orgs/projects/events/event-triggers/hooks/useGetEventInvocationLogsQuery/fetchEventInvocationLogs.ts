import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetEventInvocationLogsArgs,
  GetEventInvocationLogsOperation,
  GetEventInvocationLogsResponse,
} from '@/utils/hasura-api/generated/schemas';

/**
 * This function fetches the invocation logs for a given event trigger.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The invocation logs for the given event trigger.
 *
 * Example payload:
 * {
 *   "type": "pg_get_event_invocation_logs",
 *   "args": {
 *     "name": "mytrigger",
 *     "source": "default",
 *     "limit": 10,
 *     "offset": 0
 *   }
 * }
 */

export interface FetchEventInvocationLogsVariables {
  args: GetEventInvocationLogsArgs;
}

export default async function fetchEventInvocationLogs({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  FetchEventInvocationLogsVariables): Promise<GetEventInvocationLogsResponse> {
  try {
    const operation: GetEventInvocationLogsOperation = {
      type: 'pg_get_event_invocation_logs',
      args: {
        name: args.name,
        source: args.source,
        limit: args.limit,
        offset: args.offset,
      },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as GetEventInvocationLogsResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
