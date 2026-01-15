import { describe, it } from 'vitest';
import type { NormalizedQueryDataRow } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import getSampleInputPayload from './getSampleInputPayload';

describe('getSampleInputPayload', () => {
  it('get sample input payload with insert operation', () => {
    const formValues: BaseEventTriggerFormValues = {
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
          '{\n  "event": {\n    "op": "",\n    "data": {\n      "old": null,\n      "new": null\n    },\n    "trace_context": {\n      "trace_id": "7a2f9e8b4c1d6e3a",\n      "span_id": "5b8c2f7e9a4d1c6b"\n    }\n  },\n  "created_at": "2025-11-12T10:39:35.742Z",\n  "id": "7f8e9d2a-b3c4-4e5f-9a1b-8c7d6e5f4a3b",\n  "delivery_info": {\n    "max_retries": 0,\n    "current_retry": 0\n  },\n  "trigger": {\n    "name": ""\n  },\n  "table": {\n    "schema": "",\n    "name": ""\n  }\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template:
            '{\n  "table": {\n    "name": {{$body.table.name}},\n    "schema": {{$body.table.schema}}\n  }\n}',
        },
      },
    };
    const columns: NormalizedQueryDataRow[] = [
      {
        column_name: 'id',
        data_type: 'uuid',
      },
      {
        column_name: 'title',
        data_type: 'text',
      },
    ];

    const result = JSON.parse(getSampleInputPayload({ formValues, columns }));

    const expected = {
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
    };

    expect(result).toEqual(expected);
  });

  it('get sample input payload with insert/update operation', () => {
    const formValues: BaseEventTriggerFormValues = {
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

    const columns: NormalizedQueryDataRow[] = [
      {
        column_name: 'id',
        data_type: 'uuid',
      },
      {
        column_name: 'title',
        data_type: 'text',
      },
    ];

    const expected = {
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
    };

    const result = JSON.parse(getSampleInputPayload({ formValues, columns }));

    expect(result).toEqual(expected);
  });
});
