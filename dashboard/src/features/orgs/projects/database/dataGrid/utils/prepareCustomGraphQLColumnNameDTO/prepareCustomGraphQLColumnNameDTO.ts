import type { ColumnsCustomizationFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditSettingsForm/sections/ColumnsCustomizationSection/ColumnsCustomizationSection';
import type { TableConfigColumnConfig } from '@/utils/hasura-api/generated/schemas';

export default function prepareCustomGraphQLColumnNameDTO(
  formValues: ColumnsCustomizationFormValues,
): TableConfigColumnConfig {
  return Object.entries(formValues.columns).reduce<TableConfigColumnConfig>(
    (acc, [columnName, columnValue]) => {
      if (columnValue.graphqlFieldName) {
        acc[columnName] = {
          custom_name: columnValue.graphqlFieldName,
        };
      }
      return acc;
    },
    {},
  );
}
