import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  AddComputedFieldArgs,
  ComputedFieldItem,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface EditComputedFieldMigrationVariables {
  args: AddComputedFieldArgs;
  original: ComputedFieldItem;
}

export default async function editComputedFieldMigration({
  appUrl,
  adminSecret,
  args,
  original,
}: MigrationOperationOptions & EditComputedFieldMigrationVariables) {
  const datasource = args.source ?? 'default';

  const originalAddArgs: AddComputedFieldArgs = {
    table: args.table,
    name: original.name,
    definition: original.definition,
    comment: original.comment,
    source: datasource,
  };

  try {
    const response = await executeMigration(
      {
        name: `update_computed_field_${args.table.schema}_${args.table.name}_${original.name}`,
        up: [
          {
            type: 'pg_drop_computed_field',
            args: {
              table: args.table,
              name: original.name,
              source: datasource,
              cascade: true,
            },
          },
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
          {
            type: 'pg_add_computed_field',
            args: originalAddArgs,
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
