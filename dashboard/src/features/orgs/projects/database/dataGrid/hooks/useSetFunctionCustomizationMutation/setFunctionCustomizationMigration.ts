import { executeMigration } from '@/utils/hasura-api/migrationFetch';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';
import type { SetFunctionCustomizationVariables } from './setFunctionCustomization';

export default async function setFunctionCustomizationMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & SetFunctionCustomizationVariables) {
  const response = await executeMigration(
    {
      name: `set_function_customization_${args.function.schema}_${args.function.name}`,
      up: [{ type: 'pg_set_function_customization', args }],
      down: [],
      datasource: args.source ?? 'default',
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
