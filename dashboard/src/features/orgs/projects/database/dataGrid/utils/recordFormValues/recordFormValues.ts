import type {
  ColumnInsertOptions,
  ColumnUpdateOptions,
  DataBrowserColumnMetadata,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { POSTGRES_DEFAULT_PLACEHOLDER } from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { serializeTemporalValue } from '@/features/orgs/projects/database/dataGrid/utils/serializeTemporalValue';
import {
  isGeoJSONGeometry,
  isSpatialType,
} from '@/features/orgs/projects/database/dataGrid/utils/spatialTypeHelpers';

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

  if (
    value !== null &&
    typeof value === 'object' &&
    (isJsonColumn(column) || isSpatialType(column.baseType))
  ) {
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

function isObject(value: unknown): value is object {
  return value !== null && typeof value === 'object';
}

/**
 * Compares an edit-form value with the row's original value and returns the
 * update to apply for the column, or `null` when the value is unchanged.
 */
export function getColumnUpdateOptions(
  column: DataBrowserColumnMetadata,
  insertOptions: ColumnInsertOptions,
  originalValue: unknown,
): ColumnUpdateOptions | null {
  if (insertOptions.fallbackValue === 'DEFAULT') {
    return { reset: 'default' };
  }

  if (insertOptions.fallbackValue === 'NULL') {
    return originalValue !== null ? { reset: 'null' } : null;
  }

  let newValue = insertOptions.value;

  // geometry input parses GeoJSON text, so the edited text is sent as-is and
  // only compared structurally with the GeoJSON object read back by the grid.
  if (
    isSpatialType(column.baseType) &&
    typeof newValue === 'string' &&
    isObject(originalValue) &&
    isGeoJSONGeometry(newValue)
  ) {
    return JSON.stringify(JSON.parse(newValue)) !==
      JSON.stringify(originalValue)
      ? { value: newValue }
      : null;
  }

  if (isJsonColumn(column) && typeof newValue === 'string') {
    try {
      newValue = JSON.parse(newValue);
    } catch {
      // Keep as string if parsing fails
    }
  }

  if (isObject(newValue) && isObject(originalValue)) {
    return JSON.stringify(newValue) !== JSON.stringify(originalValue)
      ? { value: newValue }
      : null;
  }

  return newValue !== originalValue ? { value: newValue } : null;
}
