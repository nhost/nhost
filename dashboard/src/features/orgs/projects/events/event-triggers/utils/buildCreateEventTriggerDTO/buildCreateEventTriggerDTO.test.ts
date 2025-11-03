import type { CreateEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildCreateEventTriggerDTO from './buildCreateEventTriggerDTO';

describe('buildCreateEventTriggerDTO', () => {
  it('should build a create event trigger DTO', () => {
    const values: CreateEventTriggerFormValues = {
      triggerName: 'mytrigger2',
      dataSource: 'default',
      tableName: 'app_states',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
    };

    const result = buildCreateEventTriggerDTO(values);

    const expected: CreateEventTriggerArgs = {
      name: 'mytrigger2',
      table: {
        name: 'app_states',
        schema: 'public',
      },
      webhook: 'https://httpbin.org/post',
      webhook_from_env: null,
      insert: {
        columns: '*',
      },
      update: null,
      delete: null,
      enable_manual: false,
      retry_conf: {
        num_retries: 0,
        interval_sec: 10,
        timeout_sec: 60,
      },
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });
});
