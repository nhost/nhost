import type {
  ColumnInsertOptions,
  DataBrowserColumnMetadata,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { serializeTemporalValue } from '@/features/orgs/projects/database/dataGrid/utils/serializeTemporalValue';

function isBooleanColumn(column: DataBrowserColumnMetadata) {
  return column.baseType === 'boolean' && !column.isArray;
}

function isJsonColumn(column: DataBrowserColumnMetadata) {
  return column.baseType === 'json' || column.baseType === 'jsonb';
}

function getBooleanFormValue(
  value: unknown,
  column: DataBrowserColumnMetadata,
) {
  if (typeof value === 'boolean') {
    return String(value);
  }

  if (value === POSTGRES_DEFAULT_PLACEHOLDER) {
    return POSTGRES_DEFAULT_PLACEHOLDER;
  }

  if (value === null) {
    return column.isNullable ? 'null' : '';
  }

  return value;
}

export function getRecordFormValue(
  column: DataBrowserColumnMetadata,
  value: unknown,
) {
  if (isBooleanColumn(column)) {
    return getBooleanFormValue(value, column);
  }

  if (value !== null && typeof value === 'object' && isJsonColumn(column)) {
    return JSON.stringify(value, null, 2);
  }

  return value;
}

function getBooleanCreateFormValue(column: DataBrowserColumnMetadata) {
  const hasDefault = Boolean(column.defaultValue || column.isIdentity);

  if (hasDefault) {
    return POSTGRES_DEFAULT_PLACEHOLDER;
  }

  return column.isNullable ? 'null' : '';
}

function getCreateRecordFormFieldValue(
  column: DataBrowserColumnMetadata,
  initialValues?: Record<string, unknown>,
) {
  const initialValue = initialValues?.[column.id];

  if (initialValue !== undefined) {
    return getRecordFormValue(column, initialValue);
  }

  if (isBooleanColumn(column)) {
    return getBooleanCreateFormValue(column);
  }

  const hasDefault = Boolean(column.defaultValue || column.isIdentity);

  if (hasDefault) {
    return POSTGRES_DEFAULT_PLACEHOLDER;
  }

  return null;
}

export function getCreateRecordFormDefaultValues(
  columns: DataBrowserColumnMetadata[],
  initialValues?: Record<string, unknown>,
) {
  return columns.reduce<Record<string, unknown>>(
    (defaultValues, column) => ({
      ...defaultValues,
      [column.id]: getCreateRecordFormFieldValue(column, initialValues),
    }),
    {},
  );
}

export function getEditRecordFormDefaultValues(
  columns: DataBrowserColumnMetadata[],
  values: Record<string, unknown>,
) {
  return columns.reduce<Record<string, unknown>>(
    (defaultValues, column) => ({
      ...defaultValues,
      [column.id]: getRecordFormValue(column, values[column.id]),
    }),
    {},
  );
}

export function getColumnInsertOptions(
  column: DataBrowserColumnMetadata,
  value: unknown,
): ColumnInsertOptions {
  if (value === POSTGRES_DEFAULT_PLACEHOLDER) {
    return { fallbackValue: 'DEFAULT' };
  }

  if (isBooleanColumn(column)) {
    if (value === 'true') {
      return { value: true };
    }

    if (value === 'false') {
      return { value: false };
    }

    if (value === 'null' || value === null) {
      return { value: null, fallbackValue: 'NULL' };
    }

    return { value };
  }

  if (value === null) {
    return { value, fallbackValue: 'NULL' };
  }

  return {
    value: serializeTemporalValue(value, column.baseType),
    isArray: column.isArray,
  };
}
