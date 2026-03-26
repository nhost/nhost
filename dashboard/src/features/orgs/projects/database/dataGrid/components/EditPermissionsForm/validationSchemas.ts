import * as Yup from 'yup';

import {
  baseValidationSchema,
  filterValidationSchema,
} from '@/features/orgs/projects/common/utils/permissions/validationSchemas/basePermissionValidationSchema';
import type { DatabaseAction } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

const dbBaseValidationSchema = baseValidationSchema.shape({
  rowCheckType: Yup.string().oneOf(['none', 'custom']).required(),
  filter: Yup.mixed().when('rowCheckType', {
    is: 'custom',
    then: () => filterValidationSchema,
    otherwise: () => Yup.mixed().nullable().strip(),
  }),
});

const selectValidationSchema = dbBaseValidationSchema.shape({
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
      // biome-ignore lint/suspicious/noExplicitAny: `from` is part of the Yup API but not typed
      const [, { value }] = (ctx as any).from;

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
      // biome-ignore lint/suspicious/noExplicitAny: `from` is part of the Yup API but not typed
      const [, { value }] = (ctx as any).from;

      if (
        (value.columnPresets.length > 1 && !selectedValue) ||
        (!!ctx.parent.column && !selectedValue)
      ) {
        return false;
      }

      return true;
    }),
});

const insertValidationSchema = dbBaseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const updateValidationSchema = dbBaseValidationSchema.shape({
  backendOnly: Yup.boolean().nullable(),
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

const deleteValidationSchema = dbBaseValidationSchema.shape({
  columnPresets: Yup.array().of(columnPresetSchema).nullable(),
});

// biome-ignore lint/suspicious/noExplicitAny: TODO
const validationSchemas: Record<DatabaseAction, Yup.ObjectSchema<any>> = {
  select: selectValidationSchema,
  insert: insertValidationSchema,
  update: updateValidationSchema,
  delete: deleteValidationSchema,
};

export default validationSchemas;
