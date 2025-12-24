import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import type { CreateCronTriggerArgs } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import buildCronTriggerDTO from './buildCronTriggerDTO';

describe('buildCronTriggerDTO', () => {
  it('build a create cron trigger DTO with request options and payload transform', () => {
    const values: BaseCronTriggerFormValues = {
      triggerName: 'triggerName',
      comment: 'triggerComment',
      webhook: 'https://httpbin.org/delay/5',
      schedule: '0 0 1 * *',
      payload: '{\n    "payload": "value"\n}',
      retryConf: {
        numRetries: 1,
        intervalSec: 11,
        timeoutSec: 61,
        toleranceSec: 21601,
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
              key: 'key',
              value: 'value',
            },
          ],
        },
      },
      payloadTransform: {
        sampleInput:
          '{\n  "name": "testName",\n  "comment": "testComment",\n  "id": "0e9027d7-d8f2-49a1-8c47-0f788c8dd314",\n  "scheduled_time": "2024-12-23T22:00:00.000Z",\n  "payload": {}\n}',
        requestBodyTransform: {
          requestBodyTransformType: 'application/json',
          template: '{\n  "payload": {{$body.payload}}\n}',
        },
      },
    };

    const result = buildCronTriggerDTO({ formValues: values });

    const expected: CreateCronTriggerArgs = {
      name: 'triggerName',
      webhook: 'https://httpbin.org/delay/5',
      schedule: '0 0 1 * *',
      payload: {
        payload: 'value',
      },
      headers: [],
      retry_conf: {
        num_retries: 1,
        retry_interval_seconds: 11,
        timeout_seconds: 61,
        tolerance_seconds: 21601,
      },
      include_in_metadata: true,
      comment: 'triggerComment',
      request_transform: {
        version: 2,
        template_engine: 'Kriti',
        method: 'POST',
        url: '{{$base_url}}/template',
        query_params: {
          key: 'value',
        },
        body: {
          action: 'transform',
          template: '{\n  "payload": {{$body.payload}}\n}',
        },
      },
    };

    expect(result).toEqual(expected);
  });
});
