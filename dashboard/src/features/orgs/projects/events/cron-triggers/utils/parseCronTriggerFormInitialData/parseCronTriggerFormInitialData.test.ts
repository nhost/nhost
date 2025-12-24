import type { BaseCronTriggerFormInitialData } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import type { CronTrigger } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
import parseCronTriggerFormInitialData from './parseCronTriggerFormInitialData';

describe('parseCronTriggerFormInitialData', () => {
  it('should return minimal form without request options/payload transform', () => {
    const cronTrigger: CronTrigger = {
      comment: 'triggerComment',
      headers: [],
      include_in_metadata: true,
      name: 'triggerName',
      payload: {},
      request_transform: {
        body: {
          action: 'transform',
          template: '{\n  "payload": {{$body.payload}}\n}',
        },
        method: 'POST',
        query_params: {
          key: 'value',
        },
        template_engine: 'Kriti',
        url: '{{$base_url}}/template',
        version: 2,
      },
      retry_conf: {
        num_retries: 1,
        retry_interval_seconds: 11,
        timeout_seconds: 61,
        tolerance_seconds: 21601,
      },
      schedule: '*/5 * * * *',
      webhook: 'https://httpbin.org/delay/5',
    };

    const result = parseCronTriggerFormInitialData(cronTrigger);

    const {
      payloadTransform: resultPayloadTransform,
      ...resultWithoutPayloadTransform
    } = result;

    const expectedWithoutPayloadTransform: BaseCronTriggerFormInitialData = {
      triggerName: 'triggerName',
      comment: 'triggerComment',
      webhook: 'https://httpbin.org/delay/5',
      schedule: '*/5 * * * *',
      payload: '{}',
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
    };

    expect(resultWithoutPayloadTransform).toEqual(
      expectedWithoutPayloadTransform,
    );

    if (!resultPayloadTransform) {
      throw new Error('Expected payloadTransform to be defined');
    }
  });
});
