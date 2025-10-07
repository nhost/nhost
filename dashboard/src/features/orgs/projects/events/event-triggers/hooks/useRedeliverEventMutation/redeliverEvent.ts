import type { MetadataOperationOptions } from '@/features/orgs/projects/remote-schemas/types';
import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  RedeliverEventArgs,
  RedeliverEventOperation,
} from '@/utils/hasura-api/generated/schemas';

/**
 * This function redelivers an event.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns Success message
 *
 * Example payload:
 * {
 *   "type": "pg_redeliver_event",
 *   "args": {
 *     "event_id": "6301c9e1-b649-4861-9419-68b4cbf9382a",
 *   }
 * }
 */

export interface RedeliverEventVariables {
  args: RedeliverEventArgs;
}

export default async function redeliverEvent({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & RedeliverEventVariables) {
  try {
    const operation: RedeliverEventOperation = {
      type: 'pg_redeliver_event',
      args: {
        event_id: args.event_id,
      },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
