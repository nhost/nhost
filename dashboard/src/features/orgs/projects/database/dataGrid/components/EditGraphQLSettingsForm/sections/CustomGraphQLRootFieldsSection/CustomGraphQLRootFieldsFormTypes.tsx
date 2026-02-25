import { z } from 'zod';

const fieldSchema = z.object({
  fieldName: z.string().optional(),
  comment: z.string().optional(),
});

export const QUERY_AND_SUBSCRIPTION_ROOT_FIELDS = [
  'select',
  'selectByPk',
  'selectAggregate',
  'selectStream',
] as const;

export const MUTATION_ROOT_FIELDS = [
  'insert',
  'insertOne',
  'update',
  'updateByPk',
  'updateMany',
  'delete',
  'deleteByPk',
] as const;

export const validationSchema = z.object({
  customTableName: z.string().optional(),
  queryAndSubscription: z.object({
    ...Object.fromEntries(
      QUERY_AND_SUBSCRIPTION_ROOT_FIELDS.map((field) => [field, fieldSchema]),
    ),
  }),
  mutation: z.object({
    ...Object.fromEntries(
      MUTATION_ROOT_FIELDS.map((field) => [field, fieldSchema]),
    ),
  }),
});

export const defaultValues: CustomGraphQLRootFieldsFormValues = {
  customTableName: '',
  queryAndSubscription: Object.fromEntries(
    QUERY_AND_SUBSCRIPTION_ROOT_FIELDS.map((field) => [
      field,
      { fieldName: '', comment: '' },
    ]),
  ) as CustomGraphQLRootFieldsFormValues['queryAndSubscription'],
  mutation: Object.fromEntries(
    MUTATION_ROOT_FIELDS.map((field) => [
      field,
      { fieldName: '', comment: '' },
    ]),
  ) as CustomGraphQLRootFieldsFormValues['mutation'],
};

export type CustomGraphQLRootFieldsFormValues = z.infer<
  typeof validationSchema
>;

export type QueryFieldName =
  (typeof QUERY_AND_SUBSCRIPTION_ROOT_FIELDS)[number];

export type MutationFieldName = (typeof MUTATION_ROOT_FIELDS)[number];

export type QueryFieldNamePath =
  `queryAndSubscription.${QueryFieldName}.fieldName`;
export type MutationFieldNamePath = `mutation.${MutationFieldName}.fieldName`;

type SectionConfig<TSection extends 'queryAndSubscription' | 'mutation'> = {
  key: TSection extends 'queryAndSubscription'
    ? QueryFieldName
    : MutationFieldName;
  label: string;
  getDefaultFieldValue: (tableName: string) => string;
  getCommentPlaceholder: (tableName: string) => string;
};

export const getFieldPlaceholder = (
  fieldConfig: SectionConfig<'queryAndSubscription' | 'mutation'>,
  tableName: string,
) => `${fieldConfig.getDefaultFieldValue(tableName)} (default)`;

const queryAndSubscriptionFieldConfig = {
  select: {
    key: 'select',
    label: 'Select',
    getDefaultFieldValue: (tableName) => tableName,
    getCommentPlaceholder: (tableName) =>
      `fetch data from the table: "${tableName}"`,
  },
  selectByPk: {
    key: 'selectByPk',
    label: 'Select by PK',
    getDefaultFieldValue: (tableName) => `${tableName}_by_pk`,
    getCommentPlaceholder: (tableName) =>
      `fetch a single row from the table: "${tableName}"`,
  },
  selectAggregate: {
    key: 'selectAggregate',
    label: 'Select aggregate',
    getDefaultFieldValue: (tableName) => `${tableName}_aggregate`,
    getCommentPlaceholder: (tableName) =>
      `fetch aggregate fields from the table: "${tableName}"`,
  },
  selectStream: {
    key: 'selectStream',
    label: 'Select stream',
    getDefaultFieldValue: (tableName) => `${tableName}_stream`,
    getCommentPlaceholder: (tableName) =>
      `stream rows from the table: "${tableName}"`,
  },
} satisfies Record<QueryFieldName, SectionConfig<'queryAndSubscription'>>;

export const QUERY_FIELDS_CONFIG = Object.values(
  queryAndSubscriptionFieldConfig,
);

const mutationFieldConfig = {
  insert: {
    key: 'insert',
    label: 'Insert',
    getDefaultFieldValue: (tableName) => `insert_${tableName}`,
    getCommentPlaceholder: (tableName) =>
      `insert data into the table: "${tableName}"`,
  },
  insertOne: {
    key: 'insertOne',
    label: 'Insert one',
    getDefaultFieldValue: (tableName) => `insert_${tableName}_one`,
    getCommentPlaceholder: (tableName) =>
      `insert a single row into the table: "${tableName}"`,
  },
  update: {
    key: 'update',
    label: 'Update',
    getDefaultFieldValue: (tableName) => `update_${tableName}`,
    getCommentPlaceholder: (tableName) =>
      `update data of the table: "${tableName}"`,
  },
  updateByPk: {
    key: 'updateByPk',
    label: 'Update by PK',
    getDefaultFieldValue: (tableName) => `update_${tableName}_by_pk`,
    getCommentPlaceholder: (tableName) =>
      `update a single row of the table: "${tableName}"`,
  },
  updateMany: {
    key: 'updateMany',
    label: 'Update many',
    getDefaultFieldValue: (tableName) => `update_many_${tableName}`,
    getCommentPlaceholder: (tableName) =>
      `update data for "many" operations of the table: "${tableName}"`,
  },
  delete: {
    key: 'delete',
    label: 'Delete',
    getDefaultFieldValue: (tableName) => `delete_${tableName}`,
    getCommentPlaceholder: (tableName) =>
      `delete data from the table: "${tableName}"`,
  },
  deleteByPk: {
    key: 'deleteByPk',
    label: 'Delete by PK',
    getDefaultFieldValue: (tableName) => `delete_${tableName}_by_pk`,
    getCommentPlaceholder: (tableName) =>
      `delete a single row from the table: "${tableName}"`,
  },
} satisfies Record<MutationFieldName, SectionConfig<'mutation'>>;

export const MUTATION_FIELDS_CONFIG = Object.values(mutationFieldConfig);
