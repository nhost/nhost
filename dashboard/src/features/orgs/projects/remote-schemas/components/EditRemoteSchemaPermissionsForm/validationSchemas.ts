import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import * as Yup from 'yup';

const ruleSchema = Yup.object().shape({
  column: Yup.string().nullable().required('Please select a column.'),
  operator: Yup.string().nullable().required('Please select an operator.'),
  value: Yup.mixed()
    .test(
      'isArray',
      'Please enter a valid value.',
      (value) =>
        typeof value === 'string' ||
        (Array.isArray(value) &&
          value.every((item) => typeof item === 'string')),
    )
    .nullable()
    .required('Please enter a value.'),
});

const ruleGroupSchema = Yup.object().shape({
  operator: Yup.string().test(
    'operator',
    'Please select an operator.',
    (selectedOperator, ctx) => {
      // `from` is part of the Yup API, but it's not typed.
      // @ts-ignore
      const [, { value }] = ctx.from;
      if (
        value.filter &&
        Object.keys(value.filter).length > 0 &&
        !selectedOperator
      ) {
        return false;
      }

      return true;
    },
  ),
  rules: Yup.array().of(ruleSchema),
  groups: Yup.array().of(Yup.lazy(() => ruleGroupSchema) as any),
});

const baseValidationSchema = Yup.object().shape({
  filter: ruleGroupSchema.nullable().required('Please select a filter type.'),
  columns: Yup.array().of(Yup.string()).nullable(),
});

const selectValidationSchema = baseValidationSchema.shape({
  limit: Yup.number()
    .label('Limit')
    .min(0, 'Limit must not be negative.')
    .nullable(),
  allowAggregations: Yup.boolean().nullable(),
  queryRootFields: Yup.array().of(Yup.string()).nullable(),
  subscriptionRootFields: Yup.array().of(Yup.string()).nullable(),
});

const columnPresetSchema = Yup.object().shape({
  column: Yup.string()
    .nullable()
    .test('column', 'Please select a column.', (selectedColumn, ctx) => {
      // `from` is part of the Yup API, but it's not typed.
      // @ts-ignore
      const [, { value }] = ctx.from;

      if (
        (value.columnPresets.length > 1 && !selectedColumn) ||
        (!!ctx.parent.value && !selectedColumn)
      ) {
        return false;
      }

      return true;
    }),
  value: Yup.string()
    .nullable()
    .test('value', 'Please enter a value.', (selectedValue, ctx) => {
      // `from` is part of the Yup API, but it's not typed.
      // @ts-ignore
      const [, { value }] = ctx.from;

      if (
        (value.columnPresets.length > 1 && !selectedValue) ||
        (!!ctx.parent.column && !selectedValue)
      ) {
        return false;
      }

      return true;
    }),
});

const insertValidationSchema = baseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const updateValidationSchema = baseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const deleteValidationSchema = baseValidationSchema.shape({
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const validationSchemas: Record<DatabaseAction, Yup.ObjectSchema<any>> = {
  select: selectValidationSchema,
  insert: insertValidationSchema,
  update: updateValidationSchema,
  delete: deleteValidationSchema,
};

export default validationSchemas;
