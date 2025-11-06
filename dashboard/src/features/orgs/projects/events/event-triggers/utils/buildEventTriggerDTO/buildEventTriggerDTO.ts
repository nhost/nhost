import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import { buildRequestTransformDTO } from '@/features/orgs/projects/events/event-triggers/utils/buildRequestTransformDTO';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import type { OperationSpec } from '@/utils/hasura-api/generated/schemas/operationSpec';

export interface BuildEventTriggerDTOParams {
  formValues: BaseEventTriggerFormValues;
  isEdit?: boolean;
}

export default function buildEventTriggerDTO({
  formValues,
  isEdit = false,
}: BuildEventTriggerDTOParams): CreateEventTriggerArgs {
  const headers = formValues.headers.map((header) => {
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

  const insert: OperationSpec = formValues.triggerOperations.includes('insert')
    ? {
        columns: '*',
      }
    : null;

  const deleteTrigger: OperationSpec = formValues.triggerOperations.includes(
    'delete',
  )
    ? {
        columns: '*',
      }
    : null;

  const update: OperationSpec = formValues.triggerOperations.includes('update')
    ? {
        columns:
          formValues.updateTriggerOn === 'all'
            ? '*'
            : formValues.updateTriggerColumns!,
      }
    : null;

  const retry_conf = {
    num_retries: formValues.retryConf.numRetries,
    interval_sec: formValues.retryConf.intervalSec,
    timeout_sec: formValues.retryConf.timeoutSec,
  };

  const enable_manual = formValues.triggerOperations.includes('manual');

  const shouldIncludeRequestTransform =
    !!formValues.requestOptionsTransform || !!formValues.payloadTransform;
  const request_transform = shouldIncludeRequestTransform
    ? buildRequestTransformDTO(formValues)
    : undefined;

  return {
    name: formValues.triggerName,
    source: formValues.dataSource,
    table: {
      name: formValues.tableName,
      schema: formValues.tableSchema,
    },
    webhook: formValues.webhook,
    webhook_from_env: null,
    insert,
    update,
    delete: deleteTrigger,
    headers,
    retry_conf,
    enable_manual,
    replace: isEdit,
    ...(shouldIncludeRequestTransform ? { request_transform } : {}),
  };
}
