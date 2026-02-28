import type { CustomGraphQLRootFieldsFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditGraphQLSettingsForm/sections/CustomGraphQLRootFieldsSection/CustomGraphQLRootFieldsFormTypes';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import type {
  CustomRootField,
  CustomRootFields,
  TableConfig,
} from '@/utils/hasura-api/generated/schemas';

type RootFieldFormValue =
  CustomGraphQLRootFieldsFormValues['queryAndSubscription'][keyof CustomGraphQLRootFieldsFormValues['queryAndSubscription']];

function buildRootField(
  field: RootFieldFormValue,
): string | CustomRootField | undefined {
  const trimmedFieldName = field.fieldName?.trim() ?? '';
  const trimmedComment = field.comment?.trim() ?? '';

  const hasFieldName = trimmedFieldName.length > 0;
  const hasComment = trimmedComment.length > 0;

  if (!hasFieldName && !hasComment) {
    return undefined;
  }

  if (!hasComment) {
    return trimmedFieldName;
  }

  const rootField: CustomRootField = {
    comment: trimmedComment,
    name: hasFieldName ? trimmedFieldName : null,
  };

  return rootField;
}

export default function prepareCustomGraphQLRootFieldsDTO(
  formValues: CustomGraphQLRootFieldsFormValues,
  prevConfig?: TableConfig,
): TableConfig {
  const customRootFields: CustomRootFields = {};

  const { customTableName, queryAndSubscription, mutation } = formValues;

  const select = buildRootField(queryAndSubscription.select);
  if (select !== undefined) {
    customRootFields.select = select;
  }

  const selectByPk = buildRootField(queryAndSubscription.selectByPk);
  if (selectByPk !== undefined) {
    customRootFields.select_by_pk = selectByPk;
  }

  const selectAggregate = buildRootField(queryAndSubscription.selectAggregate);
  if (selectAggregate !== undefined) {
    customRootFields.select_aggregate = selectAggregate;
  }

  const selectStream = buildRootField(queryAndSubscription.selectStream);
  if (selectStream !== undefined) {
    customRootFields.select_stream = selectStream;
  }

  const insert = buildRootField(mutation.insert);
  if (insert !== undefined) {
    customRootFields.insert = insert;
  }

  const insertOne = buildRootField(mutation.insertOne);
  if (insertOne !== undefined) {
    customRootFields.insert_one = insertOne;
  }

  const update = buildRootField(mutation.update);
  if (update !== undefined) {
    customRootFields.update = update;
  }

  const updateByPk = buildRootField(mutation.updateByPk);
  if (updateByPk !== undefined) {
    customRootFields.update_by_pk = updateByPk;
  }

  const updateMany = buildRootField(mutation.updateMany);
  if (updateMany !== undefined) {
    customRootFields.update_many = updateMany;
  }

  const deleteField = buildRootField(mutation.delete);
  if (deleteField !== undefined) {
    customRootFields.delete = deleteField;
  }

  const deleteByPk = buildRootField(mutation.deleteByPk);
  if (deleteByPk !== undefined) {
    customRootFields.delete_by_pk = deleteByPk;
  }

  const customName = isEmptyValue(customTableName)
    ? null
    : customTableName!.trim();

  const newConfig: TableConfig = {
    column_config: {},
    custom_root_fields: customRootFields,
    custom_name: customName,
  };
  if (isNotEmptyValue(prevConfig?.custom_column_names)) {
    Object.entries(prevConfig.custom_column_names).forEach(
      ([columnName, customColumnName]) => {
        newConfig.column_config![columnName] = prevConfig.column_config?.[
          columnName
        ] ?? { custom_name: customColumnName };
      },
    );
  } else {
    newConfig.column_config = prevConfig?.column_config ?? {};
  }

  return newConfig;
}
