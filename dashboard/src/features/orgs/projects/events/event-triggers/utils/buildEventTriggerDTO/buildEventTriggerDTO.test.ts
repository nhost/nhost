import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildEventTriggerDTO from './buildEventTriggerDTO';

describe('buildEventTriggerDTO', () => {
  it('should build a create event trigger DTO', () => {
    const values: BaseEventTriggerFormValues = {
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

    const result = buildEventTriggerDTO({ formValues: values });

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
      replace: false,
    };

    expect(result).toEqual(expected);
  });
  it('should build a edit event trigger DTO', () => {
    const values: BaseEventTriggerFormValues = {
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

    const result = buildEventTriggerDTO({ formValues: values, isEdit: true });

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
      replace: true,
    };

    expect(result).toEqual(expected);
  });
});
