import * as yup from 'yup';
import { TIME_PATTERN } from '@/components/common/TimePickerField/isValidTime';
import type { DataBrowserColumnMetadata } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import {
  isDateType,
  isIntervalType,
  isTimestampType,
  isTimeType,
} from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';

export interface ColumnDetails {
  isNullable: boolean;
  isIdentity: boolean;
  hasDefaultValue: boolean;
}

function createGenericValidationSchema<T extends yup.Schema>(
  genericSchema: T,
  { isNullable, hasDefaultValue, isIdentity }: ColumnDetails,
): T {
  const schema = genericSchema.transform((value) => value ?? null);

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
      if (!value || value === POSTGRES_DEFAULT_PLACEHOLDER) {
        return true;
      }

      try {
        JSON.parse(value);

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

function createBooleanValidationSchema(details: ColumnDetails) {
  const booleanSchema = yup.string().test((value, { createError }) => {
    const isTrueOrFalse = value === 'true' || value === 'false';
    const isNull = value === null;
    const isNullOption = value === 'null';
    const isDefault = value === POSTGRES_DEFAULT_PLACEHOLDER;
    const canUseDefault = details.hasDefaultValue || details.isIdentity;

    if (isTrueOrFalse) {
      return true;
    }

    if (isDefault && canUseDefault) {
      return true;
    }

    if ((isNull || value === undefined) && canUseDefault) {
      return true;
    }

    if ((isNull || isNullOption) && details.isNullable) {
      return true;
    }

    return createError({ message: 'This field is required.' });
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
  columns: DataBrowserColumnMetadata[],
) {
  const schema = columns.reduce((currentSchema, column) => {
    const isNullable = column.isNullable;
    const isIdentity = column.isIdentity;

    const hasDefaultValue =
      typeof column.defaultValue !== 'undefined' &&
      column.defaultValue !== null;

    const details: ColumnDetails = {
      isNullable: Boolean(isNullable),
      isIdentity: Boolean(isIdentity),
      hasDefaultValue,
    };

    const { baseType } = column;

    // Arrays are entered as a JSON-array literal in a free-text box; the server
    // validates the element contents. Checked first so an `integer[]` is never
    // mistaken for a scalar `integer`.
    if (column.isArray) {
      return {
        ...currentSchema,
        [column.id]: createTextValidationSchema(details),
      };
    }

    if (baseType === 'uuid') {
      return {
        ...currentSchema,
        [column.id]: createUUIDValidationSchema(details),
      };
    }

    if (isTimeType(baseType)) {
      return {
        ...currentSchema,
        [column.id]: createTextValidationSchema(details).matches(
          TIME_PATTERN,
          'This is not a valid time (e.g: HH:MM:SS / HH:MM / HH:MM:SS+00).',
        ),
      };
    }

    // interval has no native input control and accepts free-form PostgreSQL
    // interval syntax ('1 day', '2 hours 30 minutes', …) — let the server
    // validate rather than constraining client-side.
    if (isIntervalType(baseType)) {
      return {
        ...currentSchema,
        [column.id]: createTextValidationSchema(details),
      };
    }

    // date / timestamp inputs preserve raw PostgreSQL literals typed by the
    // user (for example fractional seconds, offsets, or `infinity`). Let the
    // database validate semantics instead of casting through JavaScript Date.
    if (isTimestampType(baseType) || isDateType(baseType)) {
      return {
        ...currentSchema,
        [column.id]: createTextValidationSchema(details),
      };
    }

    if (baseType === 'boolean') {
      return {
        ...currentSchema,
        [column.id]: createBooleanValidationSchema(details),
      };
    }

    if (baseType === 'json' || baseType === 'jsonb') {
      return {
        ...currentSchema,
        [column.id]: createJSONValidationSchema(details),
      };
    }

    return {
      ...currentSchema,
      [column.id]: createTextValidationSchema(details),
    };
  }, {});

  return yup.object(schema).required();
}
