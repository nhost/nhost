import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { describe, expect, it } from 'vitest';
import parseEventTriggerFormInitialData from './parseEventTriggerFormInitialData';

describe('parseEventTriggerFormInitialData', () => {
  it.skip('should return empty array when tables have no event triggers', () => {
    const eventTrigger: EventTriggerViewModel = {
      name: 'user_created',
      dataSource: 'default',
      table: { name: 'users', schema: 'public' },
      webhook_from_env: 'SERVICE_URL',
      retry_conf: {
        num_retries: 0,
        interval_sec: 10,
        timeout_sec: 60,
      },
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
    };
    const result = parseEventTriggerFormInitialData(eventTrigger);
    expect(result).toEqual({
      triggerName: 'user_created',
      dataSource: 'default',
      tableName: 'users',
      tableSchema: 'public',
      webhook: '{{SERVICE_URL}}',
      triggerOperations: ['insert'],
      retryConf: {
        numRetries: 0,
        intervalSec: 10,
        timeoutSec: 60,
      },
      updateTriggerOn: 'all',
      updateTriggerColumns: [],
      headers: [],
    });
  });
});
