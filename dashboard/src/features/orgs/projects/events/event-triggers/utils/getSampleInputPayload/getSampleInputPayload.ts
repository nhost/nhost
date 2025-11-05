import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { isEmptyValue } from '@/lib/utils';
import type { ColumnValue } from '@/utils/hasura-api/types';

const getValueFromDataType = (type: string, name: string): ColumnValue => {
  const maxNum = 20;
  const typeStr = type.toLowerCase();
  if (typeStr === 'integer' || typeStr === 'numeric' || typeStr === 'int') {
    return Math.floor(Math.random() * maxNum);
  }
  if (typeStr === 'boolean') {
    return true;
  }
  if (typeStr.includes('date') || typeStr.includes('timestamp')) {
    return new Date().toISOString();
  }
  return name;
};

const getSampleEventData = ({
  formValues,
  columns,
  op,
}: {
  formValues: BaseEventTriggerFormValues;
  columns?: NormalizedQueryDataRow[];
  op: string;
}) => {
  const eventData: {
    old: Record<string, ColumnValue> | null;
    new: Record<string, ColumnValue> | null;
  } = { old: null, new: null };

  if (isEmptyValue(columns)) {
    return eventData;
  }

  if (op === 'UPDATE') {
    let selectedColumns = columns;
    if (formValues.updateTriggerOn === 'choose') {
      selectedColumns = selectedColumns?.filter((column) =>
        formValues.updateTriggerColumns?.includes(column.column_name),
      );
    }
    const oldData: Record<string, ColumnValue> = {};
    selectedColumns?.forEach((column) => {
      oldData[column.column_name] = getValueFromDataType(
        column.data_type,
        column.column_name,
      );
    });
    const newData: Record<string, ColumnValue> = {};
    selectedColumns?.forEach((column) => {
      newData[column.column_name] = getValueFromDataType(
        column.data_type,
        column.column_name,
      );
    });
    eventData.old = oldData;
    eventData.new = newData;
  }

  if (op === 'DELETE') {
    const oldData: Record<string, ColumnValue> = {};
    columns?.forEach((column) => {
      oldData[column.column_name] = getValueFromDataType(
        column.data_type,
        column.column_name,
      );
    });
    eventData.old = oldData;
  }
  if (op === 'INSERT' || op === 'MANUAL') {
    const newData: Record<string, ColumnValue> = {};
    columns?.forEach((column) => {
      newData[column.column_name] = getValueFromDataType(
        column.data_type,
        column.column_name,
      );
    });
    eventData.new = newData;
  }
  return eventData;
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
          trace_id: '7a2f9e8b4c1d6e3a',
          span_id: '5b8c2f7e9a4d1c6b',
        },
      },
      created_at: new Date().toISOString(),
      id: '7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b',
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

  const data = getSampleEventData({ formValues, columns, op });

  const obj = {
    event: {
      op,
      data,
      trace_context: {
        trace_id: '7a2f9e8b4c1d6e3a',
        span_id: '5b8c2f7e9a4d1c6b',
      },
    },
    created_at: new Date().toISOString(),
    id: '7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b',
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
