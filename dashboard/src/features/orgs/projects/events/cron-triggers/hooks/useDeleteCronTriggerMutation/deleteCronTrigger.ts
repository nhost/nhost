import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  DeleteCronTriggerArgs,
  DeleteCronTriggerOperation,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteCronTriggerVariables {
  args: DeleteCronTriggerArgs;
}

export default async function deleteCronTrigger({
  appUrl,
  adminSecret,
  args,
}: MetadataOperationOptions & DeleteCronTriggerVariables) {
  try {
    const response = await metadataOperation(
      {
        type: 'delete_cron_trigger',
        args,
      } satisfies DeleteCronTriggerOperation,
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
