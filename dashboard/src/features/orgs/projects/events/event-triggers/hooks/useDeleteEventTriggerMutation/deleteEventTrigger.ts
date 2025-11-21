import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  DeleteEventTriggerBulkOperation,
  DeleteEventTriggerStepArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteEventTriggerVariables {
  args: DeleteEventTriggerStepArgs;
  resourceVersion?: number;
}

export async function deleteEventTrigger({
  appUrl,
  adminSecret,
  args,
  resourceVersion,
}: MetadataOperationOptions & DeleteEventTriggerVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_delete_event_trigger',
            args: {
              ...args,
            },
          },
        ],
      } satisfies DeleteEventTriggerBulkOperation,
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
