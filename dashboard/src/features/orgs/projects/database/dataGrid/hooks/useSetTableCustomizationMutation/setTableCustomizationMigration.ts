import { executeMigration } from '@/utils/hasura-api/generated/default/default';
import type {
  SetTableCustomizationArgs,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';
import type { MigrationOperationOptions } from '@/utils/hasura-api/types';

export interface SetTableCustomizationMigrationVariables {
  args: SetTableCustomizationArgs;
  prevConfig?: TableConfig;
  customizationType: 'CUSTOM_ROOT_FIELDS' | 'CUSTOM_COLUMN_NAMES';
}

export default async function setTableCustomizationMigration({
  appUrl,
  adminSecret,
  prevConfig,
  customizationType,
  args,
}: MigrationOperationOptions & SetTableCustomizationMigrationVariables) {
  const migrationName =
    customizationType === 'CUSTOM_ROOT_FIELDS'
      ? `set_custom_root_fields_${args.table.schema}_${args.table.name}`
      : `alter_table_${args.table.schema}_${args.table.name}_alter_column_name_custom_fields`;
  try {
    const response = await executeMigration(
      {
        name: migrationName,
        down: [
          {
            type: 'pg_set_table_customization',
            args: {
              ...args,
              configuration: prevConfig,
            },
          },
        ],
        up: [
          {
            type: 'pg_set_table_customization',
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
