import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import type { Row } from '@tanstack/react-table';
import { FormProvider, useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useTablePath } from '@/features/orgs/projects/database/common/hooks/useTablePath';
import type { BaseRecordFormProps } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { BaseRecordForm } from '@/features/orgs/projects/database/dataGrid/components/BaseRecordForm';
import { useUpdateRecordWithToastMutation } from '@/features/orgs/projects/database/dataGrid/hooks/useUpdateRecordMutation';
import type {
  ColumnInsertOptions,
  ColumnUpdateOptions,
} from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import {
  POSTGRES_DEFAULT_PLACEHOLDER,
  wrapResolverWithDefaultPlaceholder,
} from '@/features/orgs/projects/database/dataGrid/utils/postgresDefaultPlaceholder';
import { createDynamicValidationSchema } from '@/features/orgs/projects/database/dataGrid/utils/validationSchemaHelpers';
import type { UnknownDataGridRow } from '@/features/orgs/projects/storage/dataGrid/components/DataGrid';
import { triggerToast } from '@/utils/toast';

export interface EditRecordFormProps
  extends Pick<BaseRecordFormProps, 'columns' | 'onCancel' | 'location'> {
  /**
   * The row to be edited.
   */
  row: Row<UnknownDataGridRow>;
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit?: () => Promise<unknown>;
  currentOffset: number;
}

function parseHexEWKBPoint(hex: string) {
  if (typeof hex !== 'string') {
    return null;
  }
  const cleanHex = hex.trim().toLowerCase();
  if (cleanHex.length !== 50) {
    return null;
  }

  const byteOrder = cleanHex.substring(0, 2);
  const isLittleEndian = byteOrder === '01';

  const type = cleanHex.substring(2, 10);
  const isPointSRID = isLittleEndian
    ? type === '01000020'
    : type === '20000001';
  if (!isPointSRID) {
    return null;
  }

  const sridHex = cleanHex.substring(10, 18);
  const xHex = cleanHex.substring(18, 34);
  const yHex = cleanHex.substring(34, 50);

  function hexToDouble(hexStr: string, littleEndian: boolean) {
    const bytes = new Uint8Array(8);
    for (let i = 0; i < 8; i += 1) {
      const byteIndex = littleEndian ? i : 7 - i;
      bytes[byteIndex] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    return view.getFloat64(0, true);
  }

  function hexToInt(hexStr: string, littleEndian: boolean) {
    const bytes = new Uint8Array(4);
    for (let i = 0; i < 4; i += 1) {
      const byteIndex = littleEndian ? i : 3 - i;
      bytes[byteIndex] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
    }
    const view = new DataView(bytes.buffer);
    return view.getInt32(0, true);
  }

  try {
    const srid = hexToInt(sridHex, isLittleEndian);
    const x = hexToDouble(xHex, isLittleEndian);
    const y = hexToDouble(yHex, isLittleEndian);

    return {
      type: 'Point',
      crs: {
        type: 'name',
        properties: {
          name: `urn:ogc:def:crs:EPSG::${srid}`,
        },
      },
      coordinates: [x, y],
    };
  } catch {
    return null;
  }
}

export function formatFormDateValue(value: unknown, specificType?: string | null) {
  if (value === null || value === undefined) {
    return value;
  }
  if (value === POSTGRES_DEFAULT_PLACEHOLDER) {
    return value;
  }

  const specType = String(specificType || '').toLowerCase();
  const isTimestamp =
    specType.includes('timestamp') || specType.includes('timestamptz');
  const isTime = specType.includes('time') && !isTimestamp;
  const isDate = specType.includes('date') && specType !== 'interval';

  if (isTimestamp) {
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  if (isDate) {
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      return value.substring(0, 10);
    }
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  if (isTime) {
    if (typeof value === 'string' && /^\d{2}:\d{2}/.test(value)) {
      return value.substring(0, 5);
    }
    const date = new Date(value as string | number | Date);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return value;
}

export default function EditRecordForm({
  row,
  onSubmit,
  currentOffset,
  ...props
}: EditRecordFormProps) {
  const {
    mutateAsync: updateRow,
    error,
    reset,
  } = useUpdateRecordWithToastMutation();
  const validationSchema = createDynamicValidationSchema(props.columns);
  const currentTablePath = useTablePath();
  const queryClient = useQueryClient();

  const form = useForm({
    defaultValues: props.columns.reduce((defaultValues, column) => {
      let value = row.original[column.id];
      const specType = column.specificType?.toLowerCase() || '';

      if (
        value !== null &&
        typeof value === 'object' &&
        (specType === 'jsonb' || specType === 'json')
      ) {
        value = JSON.stringify(value, null, 2);
      } else if (
        typeof value === 'string' &&
        (specType.startsWith('geography') || specType.startsWith('geometry'))
      ) {
        const parsed = parseHexEWKBPoint(value);
        if (parsed) {
          value = JSON.stringify(parsed, null, 2);
        }
      } else if (column.type === 'date') {
        value = formatFormDateValue(value, column.specificType);
      } else if (column.type === 'boolean') {
        if (value === true || value === 'true') {
          value = 'true';
        } else if (value === false || value === 'false') {
          value = 'false';
        } else if (value === POSTGRES_DEFAULT_PLACEHOLDER) {
          value = 'default';
        } else if (value === null) {
          value = column.isNullable ? 'null' : '';
        }
      }

      return { ...defaultValues, [column.id]: value };
    }, {}),
    reValidateMode: 'onSubmit',
    resolver: wrapResolverWithDefaultPlaceholder(yupResolver(validationSchema)),
  });

  async function handleSubmit(values: Record<string, ColumnInsertOptions>) {
    try {
      const columnsToUpdate: Record<string, ColumnUpdateOptions> = {};

      for (const column of props.columns) {
        const key = column.id;
        const insertOptions = values[key];
        if (!insertOptions) {
          continue;
        }

        const originalValue = row.original[key];

        if (insertOptions.fallbackValue === 'DEFAULT') {
          columnsToUpdate[key] = { reset: 'default' };
          continue;
        }

        if (insertOptions.fallbackValue === 'NULL') {
          if (originalValue !== null) {
            columnsToUpdate[key] = { reset: 'null' };
          }
          continue;
        }

        let newValue = insertOptions.value;

        const specType = column.specificType?.toLowerCase() || '';
        const isJson = specType === 'jsonb' || specType === 'json';
        const isGeo = specType.startsWith('geography') || specType.startsWith('geometry');

        if ((isJson || isGeo) && typeof newValue === 'string') {
          try {
            newValue = JSON.parse(newValue);
          } catch {
            // Keep as string if parsing fails
          }
        }

        if (
          column.type === 'date' &&
          newValue !== null &&
          newValue !== undefined &&
          originalValue !== null &&
          originalValue !== undefined
        ) {
          try {
            const newTime = new Date(String(newValue)).getTime();
            const originalTime = new Date(String(originalValue)).getTime();
            if (newTime !== originalTime) {
              columnsToUpdate[key] = { value: newValue };
            }
          } catch {
            if (newValue !== originalValue) {
              columnsToUpdate[key] = { value: newValue };
            }
          }
          continue;
        }

        if (
          typeof newValue === 'object' &&
          newValue !== null &&
          typeof originalValue === 'object' &&
          originalValue !== null
        ) {
          if (JSON.stringify(newValue) !== JSON.stringify(originalValue)) {
            columnsToUpdate[key] = { value: newValue };
          }
          continue;
        }

        if (newValue !== originalValue) {
          columnsToUpdate[key] = { value: newValue };
        }
      }

      if (Object.keys(columnsToUpdate).length > 0) {
        await updateRow({
          row,
          columnsToUpdate,
        });

        if (onSubmit) {
          await onSubmit();
          await queryClient.invalidateQueries({
            queryKey: [currentTablePath, currentOffset],
          });
        }
      }

      triggerToast('The row has been updated successfully.');
    } catch {
      // Error is handled by the mutation or toast wrapper.
    }
  }

  return (
    <FormProvider {...form}>
      {error && error instanceof Error ? (
        <div className="-mt-3 mb-4 px-6">
          <Alert
            variant="destructive"
            className="grid grid-flow-col items-center justify-between border-none bg-[#f1315433] px-4 py-3"
          >
            <span className="text-left">
              <strong>Error:</strong> {error.message}
            </span>
            <Button
              onClick={reset}
              size="sm"
              variant="destructive"
              className="bg-transparent text-[#c91737] hover:bg-[#f131541a]"
            >
              Clear
            </Button>
          </Alert>
        </div>
      ) : null}

      <BaseRecordForm
        submitButtonText="Save"
        onSubmit={handleSubmit}
        {...props}
      />
    </FormProvider>
  );
}
