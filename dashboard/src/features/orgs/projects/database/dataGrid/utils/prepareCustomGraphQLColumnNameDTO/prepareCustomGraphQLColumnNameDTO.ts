import type { ColumnsNameCustomizationFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/sections/ColumnsNameCustomizationSection/ColumnsNameCustomizationSection';
import { isEmptyValue } from '@/lib/utils';
import type {
  TableConfig,
  TableConfigColumnConfig,
} from '@/utils/hasura-api/generated/schemas';

export default function prepareCustomGraphQLColumnNameDTO(
  formValues: ColumnsNameCustomizationFormValues,
  prevConfig?: TableConfig,
): TableConfig {
  let newConfig: TableConfig;

  if (isEmptyValue(prevConfig)) {
    newConfig = {
      custom_name: null,
      custom_root_fields: {},
    };
  } else {
    const { custom_root_fields } = prevConfig!;

    const customName = isEmptyValue(prevConfig!.custom_name)
      ? null
      : prevConfig!.custom_name;

    newConfig = {
      custom_root_fields,
      custom_name: customName,
    };
  }

  const columnConfig = Object.entries(
    formValues.columns,
  ).reduce<TableConfigColumnConfig>((acc, [columnName, columnValue]) => {
    if (columnValue.graphqlFieldName) {
      // biome-ignore lint/style/noParameterAssign: Disabled to avoid spread operator performance overhead in reduce.
      acc[columnName] = {
        custom_name: columnValue.graphqlFieldName,
      };
    }
    return acc;
  }, {});
  newConfig = {
    ...newConfig,
    column_config: columnConfig,
  };

  return newConfig;
}
