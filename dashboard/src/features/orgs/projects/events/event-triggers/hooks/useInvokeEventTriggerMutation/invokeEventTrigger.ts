import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  InvokeEventTriggerArgs,
  InvokeEventTriggerOperation,
  InvokeEventTriggerResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function invokes an event trigger.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @param args - The arguments for the metadata operation.
 * @returns Success message
 *
 * Example payload:
 * {
 *   "type": "pg_invoke_event_trigger",
 *   "args": {
 *     "name": "triggerName",
 *     "source": "default",
 *     "payload": {
 *       "id": "cda96570-e636-4028-a729-ac97157faff9",
 *       "title": "asd"
 *     }
 *   }
 * }
 */

export interface InvokeEventTriggerVariables {
  args: InvokeEventTriggerArgs;
}

export default async function invokeEventTrigger({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & InvokeEventTriggerVariables) {
  try {
    const operation: InvokeEventTriggerOperation = {
      type: 'pg_invoke_event_trigger',
      args: { ...args, source: args.source ?? 'default' },
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      return response.data as InvokeEventTriggerResponse;
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
