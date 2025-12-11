import { metadataOperation } from '@/utils/hasura-api/generated/default/default';
import type {
  CronTrigger,
  GetCronTriggersOperation,
  GetCronTriggersResponse,
} from '@/utils/hasura-api/generated/schemas';
import type { MetadataOperationOptions } from '@/utils/hasura-api/types';

/**
 * This function fetches the cron triggers of the project.
 *
 * @param appUrl - The URL of the app service.
 * @param adminSecret - The admin secret of the project.
 * @returns The cron triggers of the project.
 *
 * Example payload:
 * {
 *   "type": "get_cron_triggers",
 *   "args": {}
 * }
 */

export default async function getCronTriggers({
  appUrl,
  adminSecret,
}: MetadataOperationOptions): Promise<CronTrigger[]> {
  try {
    const operation: GetCronTriggersOperation = {
      type: 'get_cron_triggers',
      args: {},
    };

    const response = await metadataOperation(operation, {
      baseUrl: appUrl,
      adminSecret,
    });

    if (response.status === 200) {
      const { cron_triggers } = response.data as GetCronTriggersResponse;
      return cron_triggers ?? [];
    }

    throw new Error(response.data.error);
  } catch (error) {
    console.error(error);
    throw error;
  }
}
