import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateScheduledEventArgs,
  CreateScheduledEventOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateOneOffVariables {
  args: CreateScheduledEventArgs;
}

export default async function createOneOff({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & CreateOneOffVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'create_scheduled_event',
        args,
      } satisfies CreateScheduledEventOperation,
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
