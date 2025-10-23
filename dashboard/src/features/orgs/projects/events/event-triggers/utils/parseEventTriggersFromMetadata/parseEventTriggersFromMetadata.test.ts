import type { EventTriggerViewModel } from '@/features/orgs/projects/events/event-triggers/types';
import type { ExportMetadataResponseMetadata } from '@/utils/hasura-api/generated/schemas';
import { describe, expect, it } from 'vitest';
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
    });
  });
});
