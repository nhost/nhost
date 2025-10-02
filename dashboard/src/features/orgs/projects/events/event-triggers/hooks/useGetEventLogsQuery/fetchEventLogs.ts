import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetEventLogsArgs,
  GetEventLogsOperation,
  GetEventLogsResponse,
} from '@/utils/hasura-api/generated/schemas';

/**
 * This function fetches the event logs for a given event trigger.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The event logs for the given event trigger.
 *
 * Example payload:
 * {
 *   "type": "pg_get_event_logs",
 *   "args": {
 *     "name": "mytrigger",
 *     "source": "default",
 *     "limit": 10,
 *     "offset": 0
 *   }
 * }
 */

export interface FetchEventLogsVariables {
  args: GetEventLogsArgs;
}

export default async function fetchEventLogs({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  FetchEventLogsVariables): Promise<GetEventLogsResponse> {
  try {
    const operation: GetEventLogsOperation = {
      type: 'pg_get_event_logs',
      args: {
        name: args.name,
        source: args.source ?? 'default',
        limit: args.limit ?? 100,
        offset: args.offset ?? 0,
      },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as GetEventLogsResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
