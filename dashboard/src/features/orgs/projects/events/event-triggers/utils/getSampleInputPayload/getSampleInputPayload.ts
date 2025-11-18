import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isEmptyValue } from '@/lib/utils';
import type { ColumnValue } from '@/utils/hasura-api/types';
import { v4 as uuidv4 } from 'uuid';

const sampleIntegerMax = 20;
const numericColumnTypes = new Set(['integer', 'numeric', 'int']);

const generateTraceContextId = () => uuidv4().replace(/-/g, '').slice(0, 16);

const generateSampleValueForColumn = (
  type: string,
  name: string,
): ColumnValue => {
  const normalizedType = type.toLowerCase();

  if (numericColumnTypes.has(normalizedType)) {
    return Math.floor(Math.random() * sampleIntegerMax);
  }

  if (normalizedType === 'boolean') {
    return true;
  }

  if (normalizedType.includes('date') || normalizedType.includes('timestamp')) {
    return new Date().toISOString();
  }

  return name;
};

const buildSampleEventData = ({
  formValues,
  columns,
  op,
}: {
  formValues: BaseEventTriggerFormValues;
  columns?: NormalizedQueryDataRow[];
  op: string;
}) => {
  const initialEventData: {
    old: Record<string, ColumnValue> | null;
    new: Record<string, ColumnValue> | null;
  } = { old: null, new: null };

  if (isEmptyValue(columns)) {
    return initialEventData;
  }

  const availableColumns = columns!;

  const buildColumnSample = (rows: NormalizedQueryDataRow[]) =>
    rows.reduce<Record<string, ColumnValue>>((acc, column) => {
      acc[column.column_name] = generateSampleValueForColumn(
        column.data_type,
        column.column_name,
      );
      return acc;
    }, {});

  if (op === 'UPDATE') {
    const columnsForUpdate =
      formValues.updateTriggerOn === 'choose'
        ? availableColumns.filter((column) =>
            formValues.updateTriggerColumns?.includes(column.column_name),
          )
        : availableColumns;

    const oldRow = buildColumnSample(columnsForUpdate);
    const newRow = buildColumnSample(columnsForUpdate);

    return {
      old: oldRow,
      new: newRow,
    };
  }

  if (op === 'DELETE') {
    const deletedRow = buildColumnSample(availableColumns);

    return {
      old: deletedRow,
      new: null,
    };
  }

  if (op === 'INSERT' || op === 'MANUAL') {
    const insertedRow = buildColumnSample(availableColumns);

    return {
      old: null,
      new: insertedRow,
    };
  }

  return initialEventData;
};

export interface GetSampleInputPayloadParams {
  formValues?: BaseEventTriggerFormValues;
  columns?: NormalizedQueryDataRow[];
}

export default function getSampleInputPayload({
  formValues,
  columns,
}: GetSampleInputPayloadParams) {
  if (!formValues) {
    const obj = {
      event: {
        op: '',
        data: {
          old: null,
          new: null,
        },
        trace_context: {
          trace_id: generateTraceContextId(),
          span_id: generateTraceContextId(),
        },
      },
      created_at: new Date().toISOString(),
      id: uuidv4(),
      delivery_info: {
        max_retries: 0,
        current_retry: 0,
      },
      trigger: {
        name: '',
      },
      table: {
        schema: '',
        name: '',
      },
    };
    return JSON.stringify(obj, null, 2);
  }
  let op = 'MANUAL';
  if (formValues.triggerOperations.includes('update')) {
    op = 'UPDATE';
  } else if (formValues.triggerOperations.includes('insert')) {
    op = 'INSERT';
  } else if (formValues.triggerOperations.includes('delete')) {
    op = 'DELETE';
  }

  const data = buildSampleEventData({ formValues, columns, op });

  const obj = {
    event: {
      op,
      data,
      trace_context: {
        trace_id: generateTraceContextId(),
        span_id: generateTraceContextId(),
      },
    },
    created_at: new Date().toISOString(),
    id: uuidv4(),
    delivery_info: {
      max_retries: formValues.retryConf.numRetries ?? 0,
      current_retry: 0,
    },
    trigger: { name: formValues.triggerName ?? 'triggerName' },
    table: {
      schema: formValues.tableSchema ?? 'schemaName',
      name: formValues.tableName ?? 'tableName',
    },
  };

  const value = JSON.stringify(obj, null, 2);
  return value;
}
