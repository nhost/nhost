import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetScheduledEventInvocationsArgs,
  GetScheduledEventInvocationsOperation,
  GetScheduledEventInvocationsResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function fetches the scheduled event invocations for a given event id.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The scheduled event invocations for the given event id.
 *
 * Example payload:
 * {
 *   "type": "get_scheduled_event_invocations",
 *   "args": {
 *     "type": "cron",
 *     "event_id": "830874a5-68a5-48c2-89cc-9e4d7875a5e5",
 *     "get_rows_count": false
 *   }
 * }
 */

export interface GetScheduledEventInvocationsVariables {
  args: GetScheduledEventInvocationsArgs;
}

export default async function getScheduledEventInvocations({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  GetScheduledEventInvocationsVariables): Promise<GetScheduledEventInvocationsResponse> {
  try {
    const operation: GetScheduledEventInvocationsOperation = {
      type: 'get_scheduled_event_invocations',
      args,
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as GetScheduledEventInvocationsResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
