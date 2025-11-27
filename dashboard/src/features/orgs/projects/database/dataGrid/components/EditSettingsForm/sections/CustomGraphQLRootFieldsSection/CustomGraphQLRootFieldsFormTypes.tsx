import { z } from 'zod';

const fieldSchema = z.object({
  fieldName: z.string().optional(),
  comment: z.string().optional(),
});

export const validationSchema = z.object({
  customTableName: z.string().optional(),
  queryAndSubscription: z.object({
    select: fieldSchema,
    selectByPk: fieldSchema,
    selectAggregate: fieldSchema,
    selectStream: fieldSchema,
  }),
  mutation: z.object({
    insert: fieldSchema,
    insertOne: fieldSchema,
    update: fieldSchema,
    updateByPk: fieldSchema,
    updateMany: fieldSchema,
    delete: fieldSchema,
    deleteByPk: fieldSchema,
  }),
});

export const defaultValues: CustomGraphQLRootFieldsFormValues = {
  customTableName: '',
  queryAndSubscription: {
    select: {
      fieldName: '',
      comment: '',
    },
    selectByPk: {
      fieldName: '',
      comment: '',
    },
    selectAggregate: {
      fieldName: '',
      comment: '',
    },
    selectStream: {
      fieldName: '',
      comment: '',
    },
  },
  mutation: {
    insert: {
      fieldName: '',
      comment: '',
    },
    insertOne: {
      fieldName: '',
      comment: '',
    },
    update: {
      fieldName: '',
      comment: '',
    },
    updateByPk: {
      fieldName: '',
      comment: '',
    },
    updateMany: {
      fieldName: '',
      comment: '',
    },
    delete: {
      fieldName: '',
      comment: '',
    },
    deleteByPk: {
      fieldName: '',
      comment: '',
    },
  },
};

export type CustomGraphQLRootFieldsFormValues = z.infer<
  typeof validationSchema
>;
export type QueryFieldName =
  keyof CustomGraphQLRootFieldsFormValues['queryAndSubscription'];
export type MutationFieldName =
  keyof CustomGraphQLRootFieldsFormValues['mutation'];

type SectionConfig<TSection extends 'queryAndSubscription' | 'mutation'> = {
  key: keyof CustomGraphQLRootFieldsFormValues[TSection];
  label: string;
  buildFieldPlaceholder: (tableName: string) => string;
  buildCommentPlaceholder: (tableName: string) => string;
};

export const queryFields: SectionConfig<'queryAndSubscription'>[] = [
  {
    key: 'select',
    label: 'Select',
    buildFieldPlaceholder: (table) => `${table} (default)`,
    buildCommentPlaceholder: (table) => `fetch data from the table: "${table}"`,
  },
  {
    key: 'selectByPk',
    label: 'Select by PK',
    buildFieldPlaceholder: (table) => `${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `fetch a single row from the table: "${table}"`,
  },
  {
    key: 'selectAggregate',
    label: 'Select aggregate',
    buildFieldPlaceholder: (table) => `${table}_aggregate (default)`,
    buildCommentPlaceholder: (table) =>
      `fetch aggregate fields from the table: "${table}"`,
  },
  {
    key: 'selectStream',
    label: 'Select stream',
    buildFieldPlaceholder: (table) => `${table}_stream (default)`,
    buildCommentPlaceholder: (table) =>
      `stream rows from the table: "${table}"`,
  },
] as const;

export const mutationFields: SectionConfig<'mutation'>[] = [
  {
    key: 'insert',
    label: 'Insert',
    buildFieldPlaceholder: (table) => `insert_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `insert data into the table: "${table}"`,
  },
  {
    key: 'insertOne',
    label: 'Insert one',
    buildFieldPlaceholder: (table) => `insert_${table}_one (default)`,
    buildCommentPlaceholder: (table) =>
      `insert a single row into the table: "${table}"`,
  },
  {
    key: 'update',
    label: 'Update',
    buildFieldPlaceholder: (table) => `update_${table} (default)`,
    buildCommentPlaceholder: (table) => `update data of the table: "${table}"`,
  },
  {
    key: 'updateByPk',
    label: 'Update by PK',
    buildFieldPlaceholder: (table) => `update_${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `update a single row of the table: "${table}"`,
  },
  {
    key: 'updateMany',
    label: 'Update many',
    buildFieldPlaceholder: (table) => `update_many_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `update data for "many" operations of the table: "${table}"`,
  },
  {
    key: 'delete',
    label: 'Delete',
    buildFieldPlaceholder: (table) => `delete_${table} (default)`,
    buildCommentPlaceholder: (table) =>
      `delete data from the table: "${table}"`,
  },
  {
    key: 'deleteByPk',
    label: 'Delete by PK',
    buildFieldPlaceholder: (table) => `delete_${table}_by_pk (default)`,
    buildCommentPlaceholder: (table) =>
      `delete a single row from the table: "${table}"`,
  },
] as const;
