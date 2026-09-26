import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { CreateCronTriggerVariables } from './createCronTrigger';

export default async function createCronTriggerMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & CreateCronTriggerVariables) {
  const response = await executeMigration(
    {
      name: args.replace
        ? `set_cron_trigger_${args.name}`
        : `create_cron_trigger_${args.name}`,
      up: [{ type: 'create_cron_trigger', args }],
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
