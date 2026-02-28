import type { CustomGraphQLRootFieldsFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/sections/CustomGraphQLRootFieldsSection/CustomGraphQLRootFieldsFormTypes';
import type {
  CustomRootField,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';

type FormFieldValue =
  CustomGraphQLRootFieldsFormValues['queryAndSubscription']['select'];

const buildFormFieldValue = (
  rootField?: string | CustomRootField | null,
): FormFieldValue => {
  if (!rootField) {
    return {
      fieldName: '',
      comment: '',
    };
  }

  if (typeof rootField === 'string') {
    return {
      fieldName: rootField,
      comment: '',
    };
  }

  return {
    fieldName: rootField.name ?? '',
    comment: rootField.comment ?? '',
  };
};

export default function parseCustomGQLRootFieldsFormDefaultValues(
  tableConfig?: TableConfig | null,
): CustomGraphQLRootFieldsFormValues {
  const customRootFields = tableConfig?.custom_root_fields;

  return {
    customTableName: tableConfig?.custom_name ?? '',
    queryAndSubscription: {
      select: buildFormFieldValue(customRootFields?.select),
      selectByPk: buildFormFieldValue(customRootFields?.select_by_pk),
      selectAggregate: buildFormFieldValue(customRootFields?.select_aggregate),
      selectStream: buildFormFieldValue(customRootFields?.select_stream),
    },
    mutation: {
      insert: buildFormFieldValue(customRootFields?.insert),
      insertOne: buildFormFieldValue(customRootFields?.insert_one),
      update: buildFormFieldValue(customRootFields?.update),
      updateByPk: buildFormFieldValue(customRootFields?.update_by_pk),
      updateMany: buildFormFieldValue(customRootFields?.update_many),
      delete: buildFormFieldValue(customRootFields?.delete),
      deleteByPk: buildFormFieldValue(customRootFields?.delete_by_pk),
    },
  };
}
