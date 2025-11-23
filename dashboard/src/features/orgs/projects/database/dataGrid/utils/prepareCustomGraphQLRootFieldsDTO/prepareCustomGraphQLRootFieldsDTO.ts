import type { CustomGraphQLRootFieldsFormValues } from '@/features/orgs/projects/database/dataGrid/components/EditSettingsForm/sections/CustomGraphQLRootFieldsForm';
import type {
  CustomRootField,
  CustomRootFields,
} from '@/utils/hasura-api/generated/schemas';

type RootFieldFormValue =
  CustomGraphQLRootFieldsFormValues['queryAndSubscription'][keyof CustomGraphQLRootFieldsFormValues['queryAndSubscription']];

type CustomRootFieldsDTO = CustomRootFields & {
  update_many?: string | CustomRootField;
};

function isCommentEnabled(
  value: RootFieldFormValue['commentEnabled'],
): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  return value === 'value';
}

function buildRootField(
  field: RootFieldFormValue,
): string | CustomRootField | undefined {
  const trimmedFieldName = field.fieldName?.trim() ?? '';
  const hasFieldName = trimmedFieldName.length > 0;

  const commentEnabled = isCommentEnabled(field.commentEnabled);

  if (!hasFieldName && !commentEnabled) {
    return undefined;
  }

  if (!commentEnabled) {
    return trimmedFieldName;
  }

  const rootField: CustomRootField = {
    comment: field.comment ?? '',
    name: hasFieldName ? trimmedFieldName : null,
  };

  return rootField;
}

export default function prepareCustomGraphQLRootFieldsDTO(
  values: CustomGraphQLRootFieldsFormValues,
): CustomRootFieldsDTO {
  const dto: CustomRootFieldsDTO = {};

  const { queryAndSubscription, mutation } = values;

  const select = buildRootField(queryAndSubscription.select);
  if (select !== undefined) {
    dto.select = select;
  }

  const selectByPk = buildRootField(queryAndSubscription.selectByPk);
  if (selectByPk !== undefined) {
    dto.select_by_pk = selectByPk;
  }

  const selectAggregate = buildRootField(queryAndSubscription.selectAggregate);
  if (selectAggregate !== undefined) {
    dto.select_aggregate = selectAggregate;
  }

  const selectStream = buildRootField(queryAndSubscription.selectStream);
  if (selectStream !== undefined) {
    dto.select_stream = selectStream;
  }

  const insert = buildRootField(mutation.insert);
  if (insert !== undefined) {
    dto.insert = insert;
  }

  const insertOne = buildRootField(mutation.insertOne);
  if (insertOne !== undefined) {
    dto.insert_one = insertOne;
  }

  const update = buildRootField(mutation.update);
  if (update !== undefined) {
    dto.update = update;
  }

  const updateByPk = buildRootField(mutation.updateByPk);
  if (updateByPk !== undefined) {
    dto.update_by_pk = updateByPk;
  }

  const updateMany = buildRootField(mutation.updateMany);
  if (updateMany !== undefined) {
    dto.update_many = updateMany;
  }

  const deleteField = buildRootField(mutation.delete);
  if (deleteField !== undefined) {
    dto.delete = deleteField;
  }

  const deleteByPk = buildRootField(mutation.deleteByPk);
  if (deleteByPk !== undefined) {
    dto.delete_by_pk = deleteByPk;
  }

  return dto;
}
