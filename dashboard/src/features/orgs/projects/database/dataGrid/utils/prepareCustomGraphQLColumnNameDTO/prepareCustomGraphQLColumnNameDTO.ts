import type { ColumnsNameCustomizationFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditSettingsForm/sections/ColumnsNameCustomizationSection/ColumnsNameCustomizationSection';
import { isEmptyValue } from '@/lib/utils';
import type {
  TableConfig,
  TableConfigColumnConfig,
} from '@/utils/hasura-api/generated/schemas';

export default function prepareCustomGraphQLColumnNameDTO(
  formValues: ColumnsNameCustomizationFormValues,
  prevConfig: TableConfig,
): TableConfig {
  const { custom_root_fields, comment } = prevConfig;

  const customName = isEmptyValue(prevConfig.custom_name)
    ? null
    : prevConfig.custom_name!;

  const columnConfig = Object.entries(
    formValues.columns,
  ).reduce<TableConfigColumnConfig>((acc, [columnName, columnValue]) => {
    if (columnValue.graphqlFieldName) {
      acc[columnName] = {
        custom_name: columnValue.graphqlFieldName,
      };
    }
    return acc;
  }, {});

  const newConfig: TableConfig = {
    column_config: columnConfig,
    custom_root_fields,
    custom_name: customName,
    comment,
  };

  return newConfig;
}
