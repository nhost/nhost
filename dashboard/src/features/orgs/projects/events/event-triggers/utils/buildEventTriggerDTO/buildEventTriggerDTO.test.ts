import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { CreateEventTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildEventTriggerDTO from './buildEventTriggerDTO';

describe('buildEventTriggerDTO', () => {
  it('build a create event trigger DTO with minimum required fields On Insert Operation', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
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
      sampleContext: [],
    };
    const result = buildEventTriggerDTO({ formValues: values });

    const expected: CreateEventTriggerArgs = {
      name: 'triggerName',
      table: {
        name: 'triggertable',
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
      replace: false,
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with On Insert Operation and Update All', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
    };

    const result = buildEventTriggerDTO({ formValues: values });

    const expected: CreateEventTriggerArgs = {
      name: 'triggerName',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      webhook: 'https://httpbin.org/post',
      webhook_from_env: null,
      insert: {
        columns: '*',
      },
      update: {
        columns: '*',
      },
      delete: null,
      enable_manual: false,
      retry_conf: {
        num_retries: 0,
        interval_sec: 10,
        timeout_sec: 60,
      },
      replace: false,
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with On Insert Operation and Update on one column', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
    };

    const result = buildEventTriggerDTO({ formValues: values });

    const expected: CreateEventTriggerArgs = {
      name: 'triggerName',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      webhook: 'https://httpbin.org/post',
      webhook_from_env: null,
      insert: {
        columns: '*',
      },
      update: {
        columns: ['title'],
      },
      delete: null,
      enable_manual: false,
      retry_conf: {
        num_retries: 0,
        interval_sec: 10,
        timeout_sec: 60,
      },
      replace: false,
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with On Delete and Manual Operation in Console', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
    };

    const result = buildEventTriggerDTO({ formValues: values });

    const expected: CreateEventTriggerArgs = {
      name: 'triggerName',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      webhook: 'https://httpbin.org/post',
      webhook_from_env: null,
      insert: null,
      update: null,
      delete: {
        columns: '*',
      },
      enable_manual: true,
      retry_conf: {
        num_retries: 0,
        interval_sec: 10,
        timeout_sec: 60,
      },
      replace: false,
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with Retry configuration and webhook with URL template', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: '{{MY_WEBHOOK_URL}}/handler',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 1,
        intervalSec: 11,
        timeoutSec: 61,
      },
      headers: [],
      sampleContext: [],
    };

    const result = buildEventTriggerDTO({ formValues: values });

    const expected: CreateEventTriggerArgs = {
      name: 'triggerName',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      webhook: '{{MY_WEBHOOK_URL}}/handler',
      webhook_from_env: null,
      insert: {
        columns: '*',
      },
      update: {
        columns: ['title'],
      },
      delete: {
        columns: '*',
      },
      enable_manual: true,
      retry_conf: {
        num_retries: 1,
        interval_sec: 11,
        timeout_sec: 61,
      },
      replace: false,
      headers: [],
      source: 'default',
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
      sampleContext: [],
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
