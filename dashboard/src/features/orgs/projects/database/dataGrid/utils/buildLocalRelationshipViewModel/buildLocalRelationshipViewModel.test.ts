import { describe, expect, it } from 'vitest';
import type { ArrayRelationshipItem } from '@/utils/hasura-api/generated/schemas';
import buildLocalRelationshipViewModel from './buildLocalRelationshipViewModel';

describe('buildLocalRelationshipViewModel (pg_suggest_relationships)', () => {
  it('fills Array relationship local columns from pg_suggest_relationships', () => {
    const relationship: ArrayRelationshipItem = {
      name: 'posts2s',
      using: {
        foreign_key_constraint_on: {
          column: 'user_id',
          table: { schema: 'public', name: 'posts2' },
        },
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship: relationship,
      type: 'Array',
      tableSchema: 'public',
      tableName: 'users',
      dataSource: 'default',
      foreignKeyRelations: [],
      suggestedRelationships: [
        {
          type: 'array',
          from: {
            table: { schema: 'public', name: 'users' },
            columns: ['id'],
          },
          to: {
            table: { schema: 'public', name: 'posts2' },
            columns: ['user_id'],
            constraint_name: 'posts2_user_id_fkey',
          },
        },
      ],
    });

    expect(result.fromLabel).toBe('public.users / id');
    expect(result.toLabel).toBe('public.posts2 / user_id');
  });

  it('falls back to Not specified when suggestions do not include a match', () => {
    const relationship: ArrayRelationshipItem = {
      name: 'posts2s',
      using: {
        foreign_key_constraint_on: {
          column: 'user_id',
          table: { schema: 'public', name: 'posts2' },
        },
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship: relationship,
      type: 'Array',
      tableSchema: 'public',
      tableName: 'users',
      dataSource: 'default',
      foreignKeyRelations: [],
      suggestedRelationships: [],
    });

    expect(result.fromLabel).toBe('public.users / Not specified');
    expect(result.toLabel).toBe('public.posts2 / user_id');
  });
});
