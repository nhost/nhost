import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { RequestTransformation } from '@/utils/hasura-api/generated/schemas';
import { describe, it } from 'vitest';
import buildRequestTransformDTO from './buildRequestTransformDTO';

describe('buildRequestTransformDTO', () => {
  it('should return undefined if request options/payload transform are not provided', () => {
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

    const result = buildRequestTransformDTO(values);

    expect(result).toBeUndefined();
  });
  it('build a simple request options transform with query params', () => {
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
      requestOptionsTransform: {
        method: 'POST',
        urlTemplate: '',
        queryParams: {
          queryParamsType: 'Key Value',
          queryParams: [
            {
              key: 'somekey',
              value: 'somevalue',
            },
            {
              key: 'somekey2',
              value: 'somevalue2',
            },
          ],
        },
      },
    };

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      method: 'POST',
      query_params: {
        somekey: 'somevalue',
        somekey2: 'somevalue2',
      },
    };

    expect(result).toEqual(expected);
  });

  it('build a simple payload transform with application/json request body transform', () => {
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

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'transform',
        template:
          '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}},\n    "op": {{$body.event.op}}\n  }\n}',
      },
    };

    expect(result).toEqual(expected);
  });

  it('build a simple payload transform with application/x-www-form-urlencoded request body transform', () => {
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
          '{\n  "event": {\n    "op": "UPDATE",\n    "data": {\n      "old": {\n        "title": "title"\n      },\n      "new": {\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-07T18:00:40.881Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/x-www-form-urlencoded',
          formTemplate: [
            {
              key: 'base_url',
              value: '{{$base_url}}',
            },
            {
              key: 'somekey',
              value: 'somevalue',
            },
          ],
        },
      },
    };

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'x_www_form_urlencoded',
        form_template: {
          base_url: '{{$base_url}}',
          somekey: 'somevalue',
        },
      },
      request_headers: {
        remove_headers: ['content-type'],
        add_headers: {
          'content-type': 'application/x-www-form-urlencoded',
        },
      },
    };

    expect(result).toEqual(expected);
  });

  it('build a simple payload transform with disabled body transform', () => {
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
          '{\n  "event": {\n    "op": "UPDATE",\n    "data": {\n      "old": {\n        "title": "title"\n      },\n      "new": {\n        "title": "title"\n      }\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-07T18:05:04.912Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": "triggerName"\n  },\n  "table": {\n    "schema": "public",\n    "name": "triggertable"\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'disabled',
        },
      },
    };

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      body: {
        action: 'remove',
      },
    };

    expect(result).toEqual(expected);
  });

  it('build a request options transform with kriti template', () => {
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
      requestOptionsTransform: {
        method: 'POST',
        urlTemplate: '/template',
        queryParams: {
          queryParamsType: 'URL string template',
          queryParamsURL: '{{concat(["redirectTo=",$base_url])}}',
        },
      },
    };

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
      version: 2,
      template_engine: 'Kriti',
      method: 'POST',
      url: '{{$base_url}}/template',
      query_params: '{{concat(["redirectTo=",$base_url])}}',
    };

    expect(result).toEqual(expected);
  });

  it('build a request transform with request options and payload transform', () => {
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

    const result = buildRequestTransformDTO(values);

    const expected: RequestTransformation = {
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
    };

    expect(result).toEqual(expected);
  });
});
