import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildTestWebhookTransformDTO from './buildTestWebhookTransformDTO';

describe('buildTestWebhookTransformDTO', () => {
  it('disabled request transform body', () => {
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
      payloadTransform: {
        sampleInput:
          '{\n  "event": {\n    "op": "INSERT",\n    "data": {\n      "old": null,\n      "new": {\n        "id": "id",\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-12T22:34:42.291Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'disabled',
        },
      },
    };

    const result = buildTestWebhookTransformDTO({ formValues: values });

    const expected: TestWebhookTransformArgs = {
      webhook_url: 'https://httpbin.org/post',
      body: {
        event: {
          op: 'INSERT',
          data: {
            old: null,
            new: {
              id: 'id',
              title: 'title',
            },
          },
          trace_context: {
            trace_id: expect.stringMatching(/^.{16}$/),
            span_id: expect.stringMatching(/^.{16}$/),
          },
        },
        created_at: expect.any(String),
        id: expect.stringMatching(/^.{36}$/),
        delivery_info: {
          max_retries: 0,
          current_retry: 0,
        },
        trigger: {
          name: 'triggerName',
        },
        table: {
          schema: 'public',
          name: 'triggertable',
        },
      },
      env: {},
      session_variables: {
        'x-hasura-admin-secret': 'xxx',
      },
      request_transform: {
        version: 2,
        template_engine: 'Kriti',
        body: {
          action: 'remove',
        },
      },
    };

    expect(result).toEqual(expected);
  });
  it('request transform body in application/json', () => {
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

    const result = buildTestWebhookTransformDTO({ formValues: values });
    const expected: TestWebhookTransformArgs = {
      webhook_url: 'https://httpbin.org/post',
      body: {
        event: {
          op: 'UPDATE',
          data: {
            old: {
              title: 'title',
            },
            new: {
              title: 'title',
            },
          },
          trace_context: {
            trace_id: expect.stringMatching(/^.{16}$/),
            span_id: expect.stringMatching(/^.{16}$/),
          },
        },
        created_at: expect.any(String),
        id: expect.stringMatching(/^.{36}$/),
        delivery_info: {
          max_retries: 0,
          current_retry: 0,
        },
        trigger: {
          name: 'triggerName',
        },
        table: {
          schema: 'public',
          name: 'triggertable',
        },
      },
      env: {},
      session_variables: {
        'x-hasura-admin-secret': 'xxx',
      },
      request_transform: {
        version: 2,
        body: {
          action: 'transform',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
        },
        template_engine: 'Kriti',
      },
    };

    expect(result).toEqual(expected);
  });
  it('request transform body in application/x-www-form-urlencoded', () => {
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
      payloadTransform: {
        sampleInput:
          '{\n  "event": {\n    "op": "INSERT",\n    "data": {\n      "old": null,\n      "new": {\n        "id": "id",\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-12T22:28:29.141Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/x-www-form-urlencoded',
          formTemplate: [
            {
              key: 'somekey',
              value: 'somevalue',
            },
          ],
        },
      },
    };
    const result = buildTestWebhookTransformDTO({ formValues: values });

    const expected: TestWebhookTransformArgs = {
      webhook_url: 'https://httpbin.org/post',
      body: {
        event: {
          op: 'INSERT',
          data: {
            old: null,
            new: {
              id: 'id',
              title: 'title',
            },
          },
          trace_context: {
            trace_id: expect.stringMatching(/^.{16}$/),
            span_id: expect.stringMatching(/^.{16}$/),
          },
        },
        created_at: expect.any(String),
        id: expect.stringMatching(/^.{36}$/),
        delivery_info: {
          max_retries: 0,
          current_retry: 0,
        },
        trigger: {
          name: 'triggerName',
        },
        table: {
          schema: 'public',
          name: 'triggertable',
        },
      },
      env: {},
      session_variables: {
        'x-hasura-admin-secret': 'xxx',
      },
      request_transform: {
        version: 2,
        body: {
          action: 'x_www_form_urlencoded',
          form_template: {
            somekey: 'somevalue',
          },
        },
        request_headers: {
          remove_headers: ['content-type'],
          add_headers: {
            'content-type': 'application/x-www-form-urlencoded',
          },
        },
        template_engine: 'Kriti',
      },
    };

    expect(result).toEqual(expected);
  });
});
