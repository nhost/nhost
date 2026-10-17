import type {
  ArrayRelationshipItem,
  ObjectRelationshipItem,
} from '@/utils/hasura-api/generated/schemas';
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

  it('matches composite object relationship columns in order', () => {
    const relationship: ObjectRelationshipItem = {
      name: 'order',
      using: {
        foreign_key_constraint_on: ['tenant_id', 'order_id'],
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship,
      type: 'Object',
      tableSchema: 'public',
      tableName: 'order_items',
      dataSource: 'default',
      foreignKeyRelations: [
        {
          columns: ['tenant_id', 'order_id'],
          referencedSchema: 'public',
          referencedTable: 'orders',
          referencedColumns: ['tenant_id', 'id'],
          updateAction: 'NO ACTION',
          deleteAction: 'NO ACTION',
        },
      ],
    });

    expect(result.fromLabel).toBe('public.order_items / tenant_id, order_id');
    expect(result.toLabel).toBe('public.orders / tenant_id, id');
  });

  it('does not match composite object relationship columns in a different order', () => {
    const relationship: ObjectRelationshipItem = {
      name: 'order',
      using: {
        foreign_key_constraint_on: ['tenant_id', 'order_id'],
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship,
      type: 'Object',
      tableSchema: 'public',
      tableName: 'order_items',
      dataSource: 'default',
      foreignKeyRelations: [
        {
          columns: ['order_id', 'tenant_id'],
          referencedSchema: 'public',
          referencedTable: 'orders',
          referencedColumns: ['id', 'tenant_id'],
          updateAction: 'NO ACTION',
          deleteAction: 'NO ACTION',
        },
      ],
    });

    expect(result.fromLabel).toBe('public.order_items / tenant_id, order_id');
    expect(result.toLabel).toBe('. / Not specified');
  });

  it('matches composite array suggestions in order', () => {
    const relationship: ArrayRelationshipItem = {
      name: 'items',
      using: {
        foreign_key_constraint_on: {
          columns: ['tenant_id', 'order_id'],
          table: { schema: 'public', name: 'order_items' },
        },
      },
    };

    const result = buildLocalRelationshipViewModel({
      relationship,
      type: 'Array',
      tableSchema: 'public',
      tableName: 'orders',
      dataSource: 'default',
      foreignKeyRelations: [],
      suggestedRelationships: [
        {
          type: 'array',
          from: {
            table: { schema: 'public', name: 'orders' },
            columns: ['tenant_id', 'id'],
          },
          to: {
            table: { schema: 'public', name: 'order_items' },
            columns: ['tenant_id', 'order_id'],
            constraint_name: 'order_items_order_fkey',
          },
        },
      ],
    });

    expect(result.fromLabel).toBe('public.orders / tenant_id, id');
    expect(result.toLabel).toBe('public.order_items / tenant_id, order_id');
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
