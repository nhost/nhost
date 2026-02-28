import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  GetEventAndInvocationLogsByIdArgs,
  GetEventAndInvocationLogsByIdOperation,
  GetEventAndInvocationLogsByIdResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function fetches the event and invocation logs for a given event id.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns The event and invocation logs for the given event id.
 *
 * Example payload:
 * {
 *   "type": "pg_get_event_by_id",
 *   "args": {
 *     "event_id": "6301c9e1-b649-4861-9419-68b4cbf9382a",
 *     "source": "default",
 *     "invocation_log_limit": 10,
 *     "invocation_log_offset": 0,
 *   }
 * }
 */

export interface FetchEventAndInvocationLogsByIdVariables {
  args: GetEventAndInvocationLogsByIdArgs;
}

export default async function fetchEventAndInvocationLogsById({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions &
  FetchEventAndInvocationLogsByIdVariables): Promise<GetEventAndInvocationLogsByIdResponse> {
  try {
    const operation: GetEventAndInvocationLogsByIdOperation = {
      type: 'pg_get_event_by_id',
      args: {
        event_id: args.event_id,
        source: args.source ?? 'default',
        invocation_log_limit: args.invocation_log_limit ?? 100,
        invocation_log_offset: args.invocation_log_offset ?? 0,
      },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as GetEventAndInvocationLogsByIdResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
