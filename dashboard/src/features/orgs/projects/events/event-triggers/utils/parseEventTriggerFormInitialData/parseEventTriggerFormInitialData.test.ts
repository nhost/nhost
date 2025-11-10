import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import { describe, expect, it } from 'vitest';
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

  it('should return minimal form without env variables in webhook');
});
