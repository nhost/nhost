import buildLocalRelationshipViewModel from '@/features/orgs/projects/database/dataGrid/utils/buildLocalRelationshipViewModel/buildLocalRelationshipViewModel';
import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';

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

  it('ignores composite foreign-key metadata identity without truncating labels', () => {
    const relationship: ObjectRelationshipItem = {
      name: 'tenantUser',
      using: {
        foreign_key_constraint_on: ['tenant_id', 'user_id'],
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship,
      type: 'Object',
      tableSchema: 'public',
      tableName: 'memberships',
      dataSource: 'default',
      foreignKeyRelations: [
        {
          name: 'memberships_user_fkey',
          columns: ['tenant_id', 'user_id'],
          referencedSchema: 'public',
          referencedTable: 'users',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'NO ACTION',
          deleteAction: 'NO ACTION',
        },
      ],
    });

    expect(result.structuralKey).toBe('');
    expect(result.fromLabel).toBe('public.memberships / tenant_id, user_id');
    expect(result.toLabel).toContain('Not specified');
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
