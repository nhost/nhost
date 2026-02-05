import { describe, expect, it } from 'vitest';
import type { CreateOneOffFormValues } from '@/features/orgs/projects/events/one-offs/components/CreateOneOffForm/CreateOneOffForm';
import buildOneOffDTO from '@/features/orgs/projects/events/one-offs/utils/buildOneOffDTO/buildOneOffDTO';

describe('buildOneOffDTO', () => {
  it('should pass through scheduleAt as ISO string without modification', () => {
    const isoDate = '2026-02-05T14:46:58.379Z';
    const values: CreateOneOffFormValues = {
      comment: '',
      webhook: 'https://example.com/webhook',
      scheduleAt: isoDate,
      payload: '{}',
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      headers: [],
    };

    const result = buildOneOffDTO(values);

    expect(result.schedule_at).toBe(isoDate);
  });

  it('should build a complete DTO with all fields', () => {
    const values: CreateOneOffFormValues = {
      comment: 'Test scheduled event',
      webhook: 'https://httpbin.org/post',
      scheduleAt: '2026-03-15T10:30:00.000Z',
      payload: '{"key": "value"}',
      retryConf: {
        numRetries: 3,
        intervalSec: 15,
        timeoutSec: 120,
      },
      headers: [
        { name: 'X-Custom-Header', type: 'fromValue', value: 'custom-value' },
        { name: 'X-Env-Header', type: 'fromEnv', value: 'MY_ENV_VAR' },
      ],
    };

    const result = buildOneOffDTO(values);

    expect(result).toEqual({
      comment: 'Test scheduled event',
      webhook: 'https://httpbin.org/post',
      schedule_at: '2026-03-15T10:30:00.000Z',
      payload: { key: 'value' },
      headers: [
        { name: 'X-Custom-Header', value: 'custom-value' },
        { name: 'X-Env-Header', value_from_env: 'MY_ENV_VAR' },
      ],
      retry_conf: {
        num_retries: 3,
        retry_interval_seconds: 15,
        timeout_seconds: 120,
      },
    });
  });
});
