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

  it('build a create event trigger DTO with additional env/value headers', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 1,
        intervalSec: 11,
        timeoutSec: 61,
      },
      headers: [
        {
          name: 'header1',
          type: 'fromValue',
          value: 'value1',
        },
        {
          name: 'header2',
          type: 'fromEnv',
          value: 'SOME_ENV_VAR',
        },
      ],
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
      headers: [
        {
          name: 'header1',
          value: 'value1',
        },
        {
          name: 'header2',
          value_from_env: 'SOME_ENV_VAR',
        },
      ],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with request transform', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
      requestOptionsTransform: {
        method: 'POST',
        urlTemplate: '/template',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [
            {
              key: 'somekey',
              value: 'somevalue',
            },
          ],
        },
      },
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
      request_transform: {
        version: 2,
        template_engine: 'Kriti',
        method: 'POST',
        url: '{{$base_url}}/template',
        query_params: {
          somekey: 'somevalue',
        },
      },
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with payload transform', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
      payloadTransform: {
        sampleInput:
          '{\n  "event": {\n    "op": "UPDATE",\n    "data": {\n      "old": {\n        "title": "title"\n      },\n      "new": {\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-07T17:54:23.856Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
        },
      },
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
      request_transform: {
        version: 2,
        template_engine: 'Kriti',
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
        },
      },
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('build a create event trigger DTO with request options and payload transform', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
      updateTriggerOn: 'choose',
      updateTriggerColumns: ['title'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
      requestOptionsTransform: {
        method: 'POST',
        urlTemplate: '/template',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [
            {
              key: 'somekey',
              value: 'somevalue',
            },
          ],
        },
      },
      payloadTransform: {
        sampleInput:
          '{\n  "event": {\n    "op": "UPDATE",\n    "data": {\n      "old": {\n        "title": "title"\n      },\n      "new": {\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-07T17:55:59.759Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
        },
      },
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
      request_transform: {
        version: 2,
        template_engine: 'Kriti',
        method: 'POST',
        url: '{{$base_url}}/template',
        query_params: {
          somekey: 'somevalue',
        },
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
        },
      },
      source: 'default',
    };

    expect(result).toEqual(expected);
  });

  it('should build an edit event trigger DTO', () => {
    const values: BaseEventTriggerFormValues = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete', 'manual'],
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
      name: 'triggerName',
      table: {
        schema: 'public',
        name: 'triggertable',
      },
      webhook: 'https://httpbin.org/post',
      webhook_from_env: null,
      insert: {
        columns: '*',
      },
      update: {
        columns: '*',
      },
      delete: {
        columns: '*',
      },
      enable_manual: true,
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
      replace: true,
      headers: [],
      source: 'default',
    };

    expect(result).toEqual(expected);
  });
});
