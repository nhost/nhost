import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetScheduledEventsArgs,
  GetScheduledEventsOperation,
  GetScheduledEventsResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function fetches the scheduled events for a given scheduled event name.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The scheduled events for the given scheduled event name.
 *
 * Example payload:
 * {
 *     "type": "get_scheduled_events",
 *     "args": {
 *         "type": "cron",
 *         "trigger_name": "cron_trigger_name",
 *         "status": [
 *             "scheduled"
 *         ],
 *         "limit": 10,
 *         "offset": 0,
 *         "get_rows_count": false
 *     }
 * }
 *
 */

export interface GetScheduledEventsVariables {
  args: GetScheduledEventsArgs;
}

export default async function getScheduledEvents({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  GetScheduledEventsVariables): Promise<GetScheduledEventsResponse> {
  try {
    const operation: GetScheduledEventsOperation = {
      type: 'get_scheduled_events',
      args,
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as GetScheduledEventsResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
