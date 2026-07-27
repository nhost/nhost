import type {
  DeleteScheduledEventArgs,
  DeleteScheduledEventOperation,
} from '@/utils/hasura-api/generated/schemas';
import { metadataOperation } from '@/utils/hasura-api/metadataFetch';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteScheduledEventVariables {
  args: DeleteScheduledEventArgs;
}

export default async function deleteScheduledEvent({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & DeleteScheduledEventVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'delete_scheduled_event',
        args,
      } satisfies DeleteScheduledEventOperation,
      {
        appUrl,
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
