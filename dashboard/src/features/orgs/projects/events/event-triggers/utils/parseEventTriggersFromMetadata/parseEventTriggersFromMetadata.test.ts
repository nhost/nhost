import { describe, expect, it } from 'vitest';
import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import type { ExportMetadataResponseMetadata } from '@/utils/hasura-api/generated/schemas';
import parseEventTriggersFromMetadata from './parseEventTriggersFromMetadata';

describe('parseEventTriggersFromMetadata', () => {
  it('should return empty array when tables have no event triggers', () => {
    const metadata: ExportMetadataResponseMetadata = {
      version: 3,
      sources: [
        {
          name: 'default',
          kind: 'postgres',
          tables: [
            {
              table: { name: 'table1', schema: 'public' },
            },
            {
              table: { name: 'table2', schema: 'public' },
            },
          ],
        },
      ],
    };
    const result = parseEventTriggersFromMetadata(metadata);
    expect(result).toEqual([]);
  });

  it('should parse event triggers from single source and table', () => {
    const metadata: ExportMetadataResponseMetadata = {
      version: 3,
      sources: [
        {
          name: 'default',
          kind: 'postgres',
          tables: [
            {
              table: { name: 'users', schema: 'public' },
              event_triggers: [
                {
                  name: 'user_created',
                  definition: {
                    enable_manual: false,
                    insert: {
                      columns: '*',
                    },
                  },
                  webhook: 'https://httpbin.org/post',
                  retry_conf: {
                    interval_sec: 10,
                    num_retries: 0,
                    timeout_sec: 60,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseEventTriggersFromMetadata(metadata);

    expect(result).toHaveLength(1);

    const expected: EventTriggerViewModel = {
      name: 'user_created',
      dataSource: 'default',
      table: { name: 'users', schema: 'public' },
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      webhook: 'https://httpbin.org/post',
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
    };

    expect(result[0]).toEqual(expected);
  });

  it('should parse multiple event triggers from multiple tables and sources', () => {
    const metadata: ExportMetadataResponseMetadata = {
      version: 3,
      sources: [
        {
          name: 'default',
          kind: 'postgres',
          tables: [
            {
              table: { name: 'users', schema: 'public' },
              event_triggers: [
                {
                  name: 'user_created',
                  definition: {
                    enable_manual: false,
                    insert: {
                      columns: '*',
                    },
                  },
                  webhook: 'https://example.com/user-webhook',
                  retry_conf: {
                    interval_sec: 10,
                    num_retries: 0,
                    timeout_sec: 60,
                  },
                },
                {
                  name: 'user_updated',
                  definition: {
                    enable_manual: true,
                    update: {
                      columns: ['email', 'name'],
                    },
                  },
                  webhook: 'https://example.com/user-update-webhook',
                  retry_conf: {
                    interval_sec: 10,
                    num_retries: 0,
                    timeout_sec: 60,
                  },
                },
              ],
            },
            {
              table: { name: 'movies', schema: 'public' },
            },
            {
              table: { name: 'orders', schema: 'public' },
              event_triggers: [
                {
                  name: 'order_placed',
                  definition: {
                    enable_manual: false,
                    insert: {
                      columns: '*',
                    },
                  },
                  retry_conf: {
                    interval_sec: 10,
                    num_retries: 0,
                    timeout_sec: 60,
                  },
                  webhook: 'https://example.com/order-webhook',
                },
              ],
            },
          ],
        },
        {
          name: 'analytics',
          kind: 'postgres',
          tables: [
            {
              table: { name: 'events', schema: 'public' },
              event_triggers: [
                {
                  name: 'event_logged',
                  definition: {
                    enable_manual: false,
                    insert: {
                      columns: '*',
                    },
                  },
                  webhook: 'https://example.com/analytics-webhook',
                  retry_conf: {
                    interval_sec: 10,
                    num_retries: 0,
                    timeout_sec: 60,
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseEventTriggersFromMetadata(metadata);

    expect(result).toHaveLength(4);

    expect(result[0]).toEqual({
      name: 'user_created',
      dataSource: 'default',
      table: { name: 'users', schema: 'public' },
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      webhook: 'https://example.com/user-webhook',
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
    });

    expect(result[1]).toEqual({
      name: 'user_updated',
      dataSource: 'default',
      table: { name: 'users', schema: 'public' },
      definition: {
        enable_manual: true,
        update: {
          columns: ['email', 'name'],
        },
      },
      webhook: 'https://example.com/user-update-webhook',
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
    });

    expect(result[2]).toEqual({
      name: 'order_placed',
      dataSource: 'default',
      table: { name: 'orders', schema: 'public' },
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      webhook: 'https://example.com/order-webhook',
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
    });

    expect(result[3]).toEqual({
      name: 'event_logged',
      dataSource: 'analytics',
      table: { name: 'events', schema: 'public' },
      definition: {
        enable_manual: false,
        insert: {
          columns: '*',
        },
      },
      webhook: 'https://example.com/analytics-webhook',
      retry_conf: {
        interval_sec: 10,
        num_retries: 0,
        timeout_sec: 60,
      },
    });
  });

  it('should parse event trigger with additional properties that are not implemented in the dashboard form (e.g. cleanup config)', () => {
    const metadata: ExportMetadataResponseMetadata = {
      version: 3,
      sources: [
        {
          name: 'default',
          kind: 'postgres',
          tables: [
            {
              table: { name: 'table1', schema: 'public' },
              event_triggers: [
                {
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
                },
              ],
            },
          ],
        },
      ],
    };

    const result = parseEventTriggersFromMetadata(metadata);

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      name: 'trigger-delete-table1',
      dataSource: 'default',
      table: { name: 'table1', schema: 'public' },
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
      cleanup_config: {
        batch_size: 20000,
        clean_invocation_logs: false,
        clear_older_than: 100,
        paused: true,
        schedule: '0 * * * 0',
        timeout: 60,
      },
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
    });
  });
});
