import type { BaseEventTriggerFormValues } from '@/features/orgs/projects/events/event-triggers/components/BaseEventTriggerForm/BaseEventTriggerFormTypes';
import type { TestWebhookTransformArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildTestWebhookTransformDTO from './buildTestWebhookTransformDTO';

describe('buildTestWebhookTransformDTO', () => {
  it('disabled request transform body', () => {
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
      sampleContext: [],
      headers: [],
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
              somenumber: 4,
              id: 'id',
            },
          },
          trace_context: {
            trace_id: '501ad47ed3570385',
            span_id: 'd586cc98cee55ad1',
          },
        },
        created_at: '2025-11-05T14:42:19.444Z',
        id: '2c173942-a860-4a4c-ab71-9a29e2384d54',
        delivery_info: {
          max_retries: 0,
          current_retry: 0,
        },
        trigger: {
          name: 'asdfasdf',
        },
        table: {
          schema: 'public',
          name: 'sometableqwe',
        },
      },
      env: {
        asdfasdfda: 'qweqewqeqwe',
        qwe: '123',
      },
      session_variables: {
        'x-hasura-admin-secret': 'xxx',
      },
      request_transform: {
        version: 2,
        body: {
          action: 'remove',
        },
        url: '{{$base_url}}',
        template_engine: 'Kriti',
      },
    };

    expect(result).toEqual(expected);
  });
  it('request transform body in application/json', () => {
    // const values: BaseEventTriggerFormValues = {
    //   triggerName: 'mytrigger2',
    //   dataSource: 'default',
    //   tableName: 'app_states',
    //   tableSchema: 'public',
    //   webhook: 'https://httpbin.org/post',
    //   triggerOperations: ['insert'],
    //   updateTriggerOn: 'all',
    //   updateTriggerColumns: [],
    //   retryConf: {
    //     numRetries: 0,
    //     intervalSec: 10,
    //     timeoutSec: 60,
    //   },
    //   headers: [],
    // };
    // const result = buildTestWebhookTransformDTO({ formValues: values });
    // const expected = {};
    // expect(result).toEqual(expected);
  });
  it('request transform body in application/x-www-form-urlencoded', () => {
    // const values: BaseEventTriggerFormValues = {
    //   triggerName: 'mytrigger2',
    //   dataSource: 'default',
    //   tableName: 'app_states',
    //   tableSchema: 'public',
    //   webhook: 'https://httpbin.org/post',
    // };
    // const expected = {
    //   webhook_url: 'https://httpbin.org/post',
    //   body: {
    //     event: {
    //       op: 'INSERT',
    //       data: {
    //         old: null,
    //         new: {
    //           somenumber: 4,
    //           id: 'id',
    //         },
    //       },
    //       trace_context: {
    //         trace_id: '501ad47ed3570385',
    //         span_id: 'd586cc98cee55ad1',
    //       },
    //     },
    //     created_at: '2025-11-05T14:42:19.444Z',
    //     id: '2c173942-a860-4a4c-ab71-9a29e2384d54',
    //     delivery_info: {
    //       max_retries: 0,
    //       current_retry: 0,
    //     },
    //     trigger: {
    //       name: 'asdfasdf',
    //     },
    //     table: {
    //       schema: 'public',
    //       name: 'sometableqwe',
    //     },
    //   },
    //   env: {
    //     asdfasdfda: 'qweqewqeqwe',
    //     qwe: '123',
    //   },
    //   session_variables: {
    //     'x-hasura-admin-secret': 'xxx',
    //   },
    //   request_transform: {
    //     version: 2,
    //     body: {
    //       action: 'x_www_form_urlencoded',
    //       form_template: {
    //         asdf: 'qweqwe',
    //         asdfg: 'qwrty',
    //         something: '{{$body.event.op}}',
    //       },
    //     },
    //     url: '{{$base_url}}',
    //     template_engine: 'Kriti',
    //   },
    // };
  });
});
