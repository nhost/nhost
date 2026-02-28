import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { SetTableIsEnumArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface SetTableIsEnumMigrationVariables {
  args: SetTableIsEnumArgs;
}

export default async function setTableIsEnumMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & SetTableIsEnumMigrationVariables) {
  try {
    const response = await executeMigration(
      {
        name: `alter_table_${args.table.schema}_${args.table.name}_set_enum_${args.is_enum ? 'true' : 'false'}`,
        down: [
          {
            type: 'pg_set_table_is_enum',
            args: {
              ...args,
              is_enum: !args.is_enum,
            },
          },
        ],
        up: [
          {
            type: 'pg_set_table_is_enum',
            args,
          },
        ],
        datasource: args.source ?? 'default',
        skip_execution: false,
      },
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
