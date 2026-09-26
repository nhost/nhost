import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { DeleteCronTriggerVariables } from './deleteCronTrigger';

export default async function deleteCronTriggerMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & DeleteCronTriggerVariables) {
  const response = await executeMigration(
    {
      name: `delete_cron_trigger_${args.name}`,
      up: [{ type: 'delete_cron_trigger', args }],
      down: [],
      datasource: 'default',
      skip_execution: false,
    },
    { appUrl, adminSecret },
  );

  if (response.status === 200) {
    return response.data;
  }

  throw new Error(
    response.data.message ?? response.data.error ?? 'Unknown error',
  );
}
