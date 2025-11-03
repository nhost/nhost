import {
  ALL_TRIGGER_OPERATIONS,
  type BaseEventTriggerFormInitialData,
} from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { isHeaderWithEnvValue } from '@/utils/hasura-api/guards';

export default function parseEventTriggerFormInitialData(
  eventTrigger: EventTriggerViewModel,
): BaseEventTriggerFormInitialData {
  const webhook = eventTrigger.webhook_from_env
    ? `{{${eventTrigger.webhook_from_env}}}`
    : (eventTrigger.webhook ?? '');

  const { definition } = eventTrigger;
  const triggerOperations = ALL_TRIGGER_OPERATIONS.filter((op) => {
    switch (op) {
      case 'insert':
        return !!definition.insert;
      case 'update':
        return !!definition.update;
      case 'delete':
        return !!definition.delete;
      case 'manual':
        return !!definition.enable_manual;
      default:
        return false;
    }
  });
  const updateTriggerOn = Array.isArray(definition.update?.columns)
    ? 'choose'
    : 'all';
  const updateTriggerColumns =
    updateTriggerOn === 'choose'
      ? (definition.update?.columns as string[])
      : [];

  const headers: BaseEventTriggerFormInitialData['headers'] =
    eventTrigger.headers?.map((header) => {
      if (isHeaderWithEnvValue(header)) {
        return {
          name: header.name,
          type: 'fromEnv',
          value: header.value_from_env,
        };
      }
      return {
        name: header.name,
        type: 'fromValue',
        value: header.value,
      };
    }) ?? [];

  return {
    triggerName: eventTrigger.name,
    dataSource: eventTrigger.dataSource,
    tableName: eventTrigger.table.name,
    tableSchema: eventTrigger.table.schema,
    webhook,
    triggerOperations,
    updateTriggerOn,
    updateTriggerColumns,
    retryConf: {
      numRetries: eventTrigger.retry_conf.num_retries ?? 0,
      intervalSec: eventTrigger.retry_conf.interval_sec ?? 10,
      timeoutSec: eventTrigger.retry_conf.timeout_sec ?? 60,
    },
    headers,
  };
}
