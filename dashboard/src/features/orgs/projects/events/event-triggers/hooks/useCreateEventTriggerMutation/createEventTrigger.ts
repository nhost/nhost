import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateEventTriggerArgs,
  CreateEventTriggerBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateEventTriggerVariables {
  args: CreateEventTriggerArgs;
  resourceVersion?: number;
}

export default async function createEventTrigger({
  appUrl,
  adminSecret,
  args,
  resourceVersion,
}: MetadataOperationOptions & CreateEventTriggerVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        source: args.source ?? 'default',
        resource_version: resourceVersion,
        args: [
          {
            type: 'pg_create_event_trigger',
            args: {
              ...args,
            },
          },
        ],
      } satisfies CreateEventTriggerBulkOperation,
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
