import * as yup from 'yup';
import type { DataBrowserGridColumnDef } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser/dataBrowser';

export interface ColumnDetails {
  isNullable: boolean;
  isIdentity: boolean;
  hasDefaultValue: boolean;
}

function createGenericValidationSchema<T extends yup.Schema>(
  genericSchema: T,
  { isNullable, hasDefaultValue, isIdentity }: ColumnDetails,
): T {
  const schema = genericSchema.transform((value) => value || null);

  if (hasDefaultValue || isIdentity) {
    return schema.optional().nullable();
  }

  if (isNullable) {
    return schema.nullable();
  }

  return schema.nullable().required('This field is required.');
}

function createTextValidationSchema(details: ColumnDetails) {
  const textSchema = yup.string();

  return createGenericValidationSchema(textSchema, details);
}

function createJSONValidationSchema(details: ColumnDetails) {
  const jsonSchema = yup
    .string()
    .test('is-json', 'This is not a valid JSON.', (value) => {
      try {
        JSON.parse(value as string);

        return true;
      } catch {
        return false;
      }
    });

  return createGenericValidationSchema(jsonSchema, details);
}

function createUUIDValidationSchema(details: ColumnDetails) {
  const uuidSchema = yup.string();

  return createGenericValidationSchema(uuidSchema, details).uuid(
    'This is not a valid UUID.',
  );
}

function createDateValidationSchema(details: ColumnDetails) {
  const dateSchema = yup
    .date()
    .transform((value) => (Number.isNaN(value) ? null : value));

  return createGenericValidationSchema(dateSchema, details);
}

function createBooleanValidationSchema(details: ColumnDetails) {
  const booleanSchema = yup.string().test((value, { createError }) => {
    const isTrueOrFalse = value === 'true' || value === 'false';

    if (details.isNullable && value !== null && !isTrueOrFalse) {
      return createError({ message: 'This field is required.' });
    }

    if (!details.isNullable && !isTrueOrFalse) {
      return createError({ message: 'This field is required.' });
    }

    return true;
  });

  return createGenericValidationSchema(booleanSchema, details);
}

/**
 * Creates a dynamic validation schema for the data browser.
 *
 * @param columns - Columns to be validated.
 * @returns Validation schema for the data browser.
 */
export function createDynamicValidationSchema(
  columns: DataBrowserGridColumnDef[],
) {
  const schema = columns.reduce((currentSchema, column) => {
    const isNullable = column.meta?.isNullable;
    const isIdentity = column.meta?.isIdentity;

    const hasDefaultValue =
      typeof column.meta?.defaultValue !== 'undefined' &&
      column.meta?.defaultValue !== null;

    const details: ColumnDetails = {
      isNullable: !!isNullable,
      isIdentity: !!isIdentity,
      hasDefaultValue,
    };

    if (column.meta?.type === 'uuid') {
      return {
        ...currentSchema,
        [column.id as string]: createUUIDValidationSchema(details),
      };
    }
    if (
      column.meta?.type === 'date' &&
      ['time', 'timetz', 'interval'].includes(
        column.meta?.specificType as string,
      )
    ) {
      return {
        ...currentSchema,
        [column.id as string]: createTextValidationSchema(details).matches(
          /^\d{2}:\d{2}(:\d{2})?$/,
          'This is not a valid time (e.g: HH:MM:SS / HH:MM).',
        ),
      };
    }

    if (column.meta?.type === 'date') {
      return {
        ...currentSchema,
        [column.id as string]: createDateValidationSchema(details),
      };
    }

    if (column.meta?.type === 'boolean') {
      return {
        ...currentSchema,
        [column.id as string]: createBooleanValidationSchema(details),
      };
    }

    if (
      column.meta?.type === 'text' &&
      (column.meta?.specificType === 'jsonb' ||
        column.meta?.specificType === 'json')
    ) {
      return {
        ...currentSchema,
        [column.id as string]: createJSONValidationSchema(details),
      };
    }

    return {
      ...currentSchema,
      [column.id as string]: createTextValidationSchema(details),
    };
  }, {});

  return yup.object(schema).required();
}
