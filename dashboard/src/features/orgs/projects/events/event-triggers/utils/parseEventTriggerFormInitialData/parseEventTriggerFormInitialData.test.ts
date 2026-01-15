import { describe, expect, it } from 'vitest';
import type { BaseEventTriggerFormInitialData } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import parseEventTriggerFormInitialData from './parseEventTriggerFormInitialData';

describe('parseEventTriggerFormInitialData', () => {
  it('should return minimal form without request options/payload transform', () => {
    const eventTrigger: EventTriggerViewModel = {
      name: 'triggerName',
      definition: {
        delete: {
          columns: '*',
        },
        enable_manual: false,
        insert: {
          columns: '*',
        },
        update: {
          columns: '*',
        },
      },
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
      webhook: 'https://httpbin.org/post',
      dataSource: 'default',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
    };

    const result = parseEventTriggerFormInitialData(eventTrigger);

    expect(result).toEqual({
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert', 'update', 'delete'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
    });
  });

  it('should return minimal form without env variables in webhook', () => {
    const eventTrigger: EventTriggerViewModel = {
      dataSource: 'default',
      table: {
        name: 'table',
        schema: 'public',
      },
      name: 'trigger-delete-table1',
      definition: {
        delete: {
          columns: '*',
        },
        enable_manual: false,
      },
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
      webhook_from_env: 'TRIGGER_ENDPOINT',
      headers: [
        {
          name: 'custom-header',
          value_from_env: 'CUSTOM_HEADER_VALUE',
        },
      ],
      request_transform: {
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
        },
        query_params: {},
        template_engine: 'Kriti',
        version: 2,
      },
      cleanup_config: {
        batch_size: 20000,
        clean_invocation_logs: false,
        clear_older_than: 100,
        paused: true,
        schedule: '0 * * * 0',
        timeout: 60,
      },
    };

    const result = parseEventTriggerFormInitialData(eventTrigger);

    const { payloadTransform } = result;

    expect(payloadTransform).toBeDefined();
    if (!payloadTransform) {
      throw new Error('Expected payloadTransform to be defined');
    }

    const expected: BaseEventTriggerFormInitialData = {
      triggerName: 'trigger-delete-table1',
      dataSource: 'default',
      tableName: 'table',
      tableSchema: 'public',
      webhook: '{{TRIGGER_ENDPOINT}}',
      triggerOperations: ['delete'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [
        {
          name: 'custom-header',
          type: 'fromEnv',
          value: 'CUSTOM_HEADER_VALUE',
        },
      ],
      sampleContext: [],
      requestOptionsTransform: {
        urlTemplate: '',
        method: 'POST',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [],
        },
      },
      payloadTransform: {
        sampleInput: payloadTransform.sampleInput,
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('should return form with payload transform and no request options transform', () => {
    const eventTrigger: EventTriggerViewModel = {
      dataSource: 'default',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      name: 'triggerName',
      definition: {
        enable_manual: true,
      },
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
      webhook: 'https://httpbin.org/post',
      request_transform: {
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
        },
        template_engine: 'Kriti',
        version: 2,
      },
    };
    const result = parseEventTriggerFormInitialData(eventTrigger);

    const {
      payloadTransform: resultPayloadTransform,
      ...resultWithoutPayloadTransform
    } = result;

    const expectedWithoutPayloadTransform: BaseEventTriggerFormInitialData = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['manual'],
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

    expect(resultWithoutPayloadTransform).toEqual(
      expectedWithoutPayloadTransform,
    );

    if (!resultPayloadTransform) {
      throw new Error('Expected resultPayloadTransform to be defined');
    }
    const { requestBodyTransform } = resultPayloadTransform;

    const expectedBodyTransform = {
      requestBodyTransformType: 'application/json',
      template:
        '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
    };

    expect(requestBodyTransform).toEqual(expectedBodyTransform);
  });

  it('should return form with request options transform and no payload transform', () => {
    const eventTrigger: EventTriggerViewModel = {
      dataSource: 'default',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      name: 'triggerName',
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      retry_conf: {
        interval_sec: 10,
        num_retries: 1,
        timeout_sec: 60,
      },
      webhook: 'https://httpbin.org/post',
      request_transform: {
        query_params: 'mytemplateurlstring=123',
        template_engine: 'Kriti',
        url: '{{$base_url}}/template',
        version: 2,
      },
    };
    const result = parseEventTriggerFormInitialData(eventTrigger);

    const expected = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 1,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
      requestOptionsTransform: {
        urlTemplate: '/template',
        method: 'POST',
        queryParams: {
          queryParamsType: 'URL string template',
          queryParamsURL: 'mytemplateurlstring=123',
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('should return form with both request options transform and payload transform', () => {
    const eventTrigger: EventTriggerViewModel = {
      dataSource: 'default',
      table: {
        name: 'triggertable',
        schema: 'public',
      },
      name: 'triggerName',
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      retry_conf: {
        interval_sec: 10,
        num_retries: 1,
        timeout_sec: 60,
      },
      webhook: 'https://httpbin.org/post',
      request_transform: {
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
        },
        method: 'PATCH',
        query_params: {
          key: 'value',
          key2: 'value2',
        },
        template_engine: 'Kriti',
        url: '{{$base_url}}/template',
        version: 2,
      },
    };
    const result = parseEventTriggerFormInitialData(eventTrigger);

    const {
      payloadTransform: resultPayloadTransform,
      ...resultWithoutPayloadTransform
    } = result;

    const expectedWithoutPayloadTransform: BaseEventTriggerFormInitialData = {
      triggerName: 'triggerName',
      dataSource: 'default',
      tableName: 'triggertable',
      tableSchema: 'public',
      webhook: 'https://httpbin.org/post',
      triggerOperations: ['insert'],
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      retryConf: {
        numRetries: 1,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
      sampleContext: [],
      requestOptionsTransform: {
        method: 'PATCH',
        urlTemplate: '/template',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [
            {
              key: 'key',
              value: 'value',
            },
            {
              key: 'key2',
              value: 'value2',
            },
          ],
        },
      },
    };

    expect(resultWithoutPayloadTransform).toEqual(
      expectedWithoutPayloadTransform,
    );

    if (!resultPayloadTransform) {
      throw new Error('Expected payloadTransform to be defined');
    }

    const { requestBodyTransform } = resultPayloadTransform;

    const expectedRequestBodyTransform = {
      requestBodyTransformType: 'application/json',
      template:
        '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
    };

    expect(requestBodyTransform).toEqual(expectedRequestBodyTransform);
  });
});
