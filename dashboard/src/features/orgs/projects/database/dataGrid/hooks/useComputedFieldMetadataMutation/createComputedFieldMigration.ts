import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type { AddComputedFieldArgs } from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface CreateComputedFieldMigrationVariables {
  args: AddComputedFieldArgs;
}

export default async function createComputedFieldMigration({
  appUrl,
  adminSecret,
  args,
}: MigrationOperationOptions & CreateComputedFieldMigrationVariables) {
  const datasource = args.source ?? 'default';
  try {
    const response = await executeMigration(
      {
        name: `add_computed_field_${args.table.schema}_${args.table.name}_${args.name}`,
        up: [
          {
            type: 'pg_add_computed_field',
            args,
          },
        ],
        down: [
          {
            type: 'pg_drop_computed_field',
            args: {
              table: args.table,
              name: args.name,
              source: datasource,
            },
          },
        ],
        datasource,
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
