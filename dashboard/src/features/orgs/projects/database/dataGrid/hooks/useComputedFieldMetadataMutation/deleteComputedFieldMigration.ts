import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  ComputedFieldItem,
  DropComputedFieldArgs,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface DeleteComputedFieldMigrationVariables {
  args: DropComputedFieldArgs;
  original: ComputedFieldItem;
}

export default async function deleteComputedFieldMigration({
  appUrl,
  adminSecret,
  args,
  original,
}: MigrationOperationOptions & DeleteComputedFieldMigrationVariables) {
  const datasource = args.source ?? 'default';

  try {
    const response = await executeMigration(
      {
        name: `drop_computed_field_${args.table.schema}_${args.table.name}_${args.name}`,
        up: [
          {
            type: 'pg_drop_computed_field',
            args: { cascade: true, ...args },
          },
        ],
        down: [
          {
            type: 'pg_add_computed_field',
            args: {
              table: args.table,
              name: original.name,
              definition: original.definition,
              comment: original.comment,
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
