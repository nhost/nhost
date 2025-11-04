import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import type { OperationSpec } from '@/utils/hasura-api/generated/schemas/operationSpec';

export default function buildCreateEventTriggerDTO(
  values: BaseEventTriggerFormValues,
): CreateEventTriggerArgs {
  const headers = values.headers.map((header) => {
    if (header.type === 'fromEnv') {
      return {
        name: header.name,
        value_from_env: header.value,
      };
    }
    return {
      name: header.name,
      value: header.value,
    };
  });

  const insert: OperationSpec = values.triggerOperations.includes('insert')
    ? {
        columns: '*',
      }
    : null;

  const deleteTrigger: OperationSpec = values.triggerOperations.includes(
    'delete',
  )
    ? {
        columns: '*',
      }
    : null;

  const update: OperationSpec = values.triggerOperations.includes('update')
    ? {
        columns:
          values.updateTriggerOn === 'all' ? '*' : values.updateTriggerColumns!,
      }
    : null;

  const retry_conf = {
    num_retries: values.retryConf.numRetries,
    interval_sec: values.retryConf.intervalSec,
    timeout_sec: values.retryConf.timeoutSec,
  };

  const enable_manual = values.triggerOperations.includes('manual');

  return {
    name: values.triggerName,
    source: values.dataSource,
    table: {
      name: values.tableName,
      schema: values.tableSchema,
    },
    webhook: values.webhook,
    webhook_from_env: null,
    insert,
    update,
    delete: deleteTrigger,
    headers,
    retry_conf,
    enable_manual,
    replace: false,
  };
}
