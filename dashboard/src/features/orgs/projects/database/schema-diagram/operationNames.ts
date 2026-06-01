import type {
  DatabaseAction,
  HasuraMetadataTable,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { isEmptyValue } from '@/lib/utils';
import type { CustomRootField } from '@/utils/hasura-api/generated/schemas';

export type OperationMetadataKey =
  | 'select'
  | 'select_by_pk'
  | 'select_aggregate'
  | 'select_stream'
  | 'insert'
  | 'insert_one'
  | 'update'
  | 'update_by_pk'
  | 'update_many'
  | 'delete'
  | 'delete_by_pk';

export interface OperationName {
  name: string;
  label: string;
  isCustom: boolean;
  metadataKey: OperationMetadataKey;
}

type CustomRootFieldsValue = string | CustomRootField | null | undefined;

interface OperationDef {
  metadataKey: OperationMetadataKey;
  label: string;
  getDefault: (tableNameAlias: string) => string;
}

const OPERATION_DEFS_BY_ACTION: Record<DatabaseAction, OperationDef[]> = {
  select: [
    {
      metadataKey: 'select',
      label: 'Select',
      getDefault: (t) => t,
    },
    {
      metadataKey: 'select_by_pk',
      label: 'Select by PK',
      getDefault: (t) => `${t}_by_pk`,
    },
    {
      metadataKey: 'select_aggregate',
      label: 'Select aggregate',
      getDefault: (t) => `${t}_aggregate`,
    },
    {
      metadataKey: 'select_stream',
      label: 'Select stream',
      getDefault: (t) => `${t}_stream`,
    },
  ],
  insert: [
    {
      metadataKey: 'insert',
      label: 'Insert',
      getDefault: (t) => `insert_${t}`,
    },
    {
      metadataKey: 'insert_one',
      label: 'Insert one',
      getDefault: (t) => `insert_${t}_one`,
    },
  ],
  update: [
    {
      metadataKey: 'update',
      label: 'Update',
      getDefault: (t) => `update_${t}`,
    },
    {
      metadataKey: 'update_by_pk',
      label: 'Update by PK',
      getDefault: (t) => `update_${t}_by_pk`,
    },
    {
      metadataKey: 'update_many',
      label: 'Update many',
      getDefault: (t) => `update_many_${t}`,
    },
  ],
  delete: [
    {
      metadataKey: 'delete',
      label: 'Delete',
      getDefault: (t) => `delete_${t}`,
    },
    {
      metadataKey: 'delete_by_pk',
      label: 'Delete by PK',
      getDefault: (t) => `delete_${t}_by_pk`,
    },
  ],
};

interface TableConfigurationShape {
  custom_name?: unknown;
  custom_root_fields?: Record<string, CustomRootFieldsValue>;
}

function defaultTableNameAlias(schema: string, table: string): string {
  // Mirrors EditGraphQLSettingsForm: non-public schemas are prefixed.
  return schema === 'public' ? table : `${schema}_${table}`;
}

function resolveCustomFieldName(
  value: CustomRootFieldsValue,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'string') {
    return isEmptyValue(value) ? undefined : value;
  }
  const name = value.name;
  if (typeof name !== 'string' || isEmptyValue(name)) {
    return undefined;
  }
  return name;
}

function resolveTableNameAlias(
  config: TableConfigurationShape | undefined,
  schema: string,
  table: string,
): string {
  const customName = config?.custom_name;
  if (typeof customName === 'string' && !isEmptyValue(customName)) {
    return customName;
  }
  return defaultTableNameAlias(schema, table);
}

export function getOperationNamesForAction(
  metadataTable: HasuraMetadataTable | undefined,
  schema: string,
  table: string,
  action: DatabaseAction,
): OperationName[] {
  if (!metadataTable) {
    return [];
  }

  const config = metadataTable.configuration as
    | TableConfigurationShape
    | undefined;
  const tableNameAlias = resolveTableNameAlias(config, schema, table);
  const customRootFields = config?.custom_root_fields;

  return OPERATION_DEFS_BY_ACTION[action].map((def) => {
    const customName = resolveCustomFieldName(
      customRootFields?.[def.metadataKey],
    );
    return {
      name: customName ?? def.getDefault(tableNameAlias),
      label: def.label,
      isCustom: customName !== undefined,
      metadataKey: def.metadataKey,
    };
  });
}
