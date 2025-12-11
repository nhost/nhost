import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CreateCronTriggerArgs,
  CreateCronTriggerBulkOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface CreateCronTriggerVariables {
  args: CreateCronTriggerArgs;
}

export default async function createCronTrigger({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & CreateCronTriggerVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'bulk',
        args: [
          {
            type: 'create_cron_trigger',
            args,
          },
        ],
      } satisfies CreateCronTriggerBulkOperation,
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
