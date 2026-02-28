import { describe, expect, it } from 'vitest';
import type { ExportMetadataResponseMetadata } from '@/utils/hasura-api/generated/schemas';

import getEventTriggersByTable from './getEventTriggersByTable';

describe('getEventTriggersByTable', () => {
  const defaultTable = { name: 'table1', schema: 'public' };
  const defaultMetadata = {
    version: 3,
    sources: [
      {
        name: 'default',
        kind: 'postgres',
        tables: [
          {
            table: defaultTable,
          },
          {
            table: { name: 'table2', schema: 'public' },
          },
        ],
      },
    ],
  } satisfies ExportMetadataResponseMetadata;

  it('returns empty array when table has no event triggers', () => {
    const result = getEventTriggersByTable({
      metadata: defaultMetadata,
      table: defaultTable,
      dataSource: 'default',
    });

    expect(result).toEqual([]);
  });

  it('returns event trigger for a single table', () => {
    const metadata = {
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
    } satisfies ExportMetadataResponseMetadata;

    const result = getEventTriggersByTable({
      metadata,
      table: { name: 'users', schema: 'public' },
      dataSource: 'default',
    });

    const expected = [
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
    ];

    expect(result).toEqual(expected);
  });

  it('returns only event triggers for the requested table and data source', () => {
    const metadata = {
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
    } satisfies ExportMetadataResponseMetadata;

    const result = getEventTriggersByTable({
      metadata,
      table: { name: 'users', schema: 'public' },
      dataSource: 'default',
    });

    const expected = metadata.sources[0]?.tables?.[0]?.event_triggers ?? [];

    expect(result).toEqual(expected);
  });

  it('preserves additional properties on returned event triggers', () => {
    const metadata = {
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
    } satisfies ExportMetadataResponseMetadata;

    const result = getEventTriggersByTable({
      metadata,
      table: { name: 'table1', schema: 'public' },
      dataSource: 'default',
    });

    const expected = metadata.sources[0]?.tables?.[0]?.event_triggers ?? [];

    expect(result).toEqual(expected);
  });

  it('returns empty array when table does not exist in the data source', () => {
    const result = getEventTriggersByTable({
      metadata: defaultMetadata,
      table: { name: 'non_existing', schema: 'public' },
      dataSource: 'default',
    });

    expect(result).toEqual([]);
  });

  it('returns empty array when data source is not found', () => {
    const result = getEventTriggersByTable({
      metadata: defaultMetadata,
      table: defaultTable,
      dataSource: 'missing',
    });

    expect(result).toEqual([]);
  });
});
