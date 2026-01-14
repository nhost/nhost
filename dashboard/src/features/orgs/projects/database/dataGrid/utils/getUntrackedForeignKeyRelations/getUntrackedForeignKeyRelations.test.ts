import type { ForeignKeyRelation } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import { describe, expect, it } from 'vitest';
import getUntrackedForeignKeyRelations from './getUntrackedForeignKeyRelations';

describe('getUntrackedForeignKeyRelations', () => {
  const createForeignKey = (
    overrides: Partial<ForeignKeyRelation> = {},
  ): ForeignKeyRelation => ({
    columnName: 'user_id',
    referencedSchema: 'public',
    referencedTable: 'users',
    referencedColumn: 'id',
    // biome-ignore lint/suspicious/noExplicitAny: test file
    updateAction: 'CASCADE' as any,
    // biome-ignore lint/suspicious/noExplicitAny: test file
    deleteAction: 'CASCADE' as any,
    oneToOne: false,
    ...overrides,
  });

  it('should return all updated relations when original is undefined', () => {
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
      createForeignKey({ columnName: 'post_id', referencedTable: 'posts' }),
    ];

    const result = getUntrackedForeignKeyRelations(undefined, updated);

    expect(result).toEqual(updated);
    expect(result).toHaveLength(2);
  });

  it('should return all updated relations when original is empty array', () => {
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
    ];

    const result = getUntrackedForeignKeyRelations([], updated);

    expect(result).toEqual(updated);
  });

  it('should return empty array when updated is undefined', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, undefined);

    expect(result).toEqual([]);
  });

  it('should return empty array when updated is empty array', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, []);

    expect(result).toEqual([]);
  });

  it('should return empty array when relations are identical', () => {
    const fk = createForeignKey({ columnName: 'user_id' });
    const original: ForeignKeyRelation[] = [fk];
    const updated: ForeignKeyRelation[] = [{ ...fk }];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toEqual([]);
  });

  it('should detect change in referencedSchema', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedSchema: 'public' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedSchema: 'private' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].referencedSchema).toBe('private');
  });

  it('should detect change in referencedTable', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedTable: 'users' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedTable: 'accounts' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].referencedTable).toBe('accounts');
  });

  it('should detect change in referencedColumn', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedColumn: 'id' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedColumn: 'uuid' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].referencedColumn).toBe('uuid');
  });

  it('should detect change in updateAction', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        updateAction: 'CASCADE' as any,
      }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        updateAction: 'RESTRICT' as any,
      }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].updateAction).toBe('RESTRICT');
  });

  it('should detect change in deleteAction', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        deleteAction: 'CASCADE' as any,
      }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        deleteAction: 'SET NULL' as any,
      }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].deleteAction).toBe('SET NULL');
  });

  it('should detect change in oneToOne', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', oneToOne: false }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', oneToOne: true }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].oneToOne).toBe(true);
  });
  it('should return new relations that do not exist in original', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
      createForeignKey({ columnName: 'post_id', referencedTable: 'posts' }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].columnName).toBe('post_id');
  });

  it('should return all new relations when original has different columns', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'post_id', referencedTable: 'posts' }),
      createForeignKey({
        columnName: 'comment_id',
        referencedTable: 'comments',
      }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(2);
    expect(result.map((fk) => fk.columnName)).toEqual([
      'post_id',
      'comment_id',
    ]);
  });
  it('should return both changed and new relations', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedTable: 'users' }),
      createForeignKey({ columnName: 'post_id', referencedTable: 'posts' }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedTable: 'accounts' }), // changed
      createForeignKey({ columnName: 'post_id', referencedTable: 'posts' }), // unchanged
      createForeignKey({
        columnName: 'comment_id',
        referencedTable: 'comments',
      }), // new
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(2);
    expect(result.map((fk) => fk.columnName).sort()).toEqual([
      'comment_id',
      'user_id',
    ]);
  });

  it('should handle multiple changes to the same column', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        referencedTable: 'users',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        updateAction: 'CASCADE' as any,
        // biome-ignore lint/suspicious/noExplicitAny: test file
        deleteAction: 'CASCADE' as any,
      }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({
        columnName: 'user_id',
        referencedTable: 'accounts',
        // biome-ignore lint/suspicious/noExplicitAny: test file
        updateAction: 'RESTRICT' as any,
        // biome-ignore lint/suspicious/noExplicitAny: test file
        deleteAction: 'SET NULL' as any,
      }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toHaveLength(1);
    expect(result[0].referencedTable).toBe('accounts');
    expect(result[0].updateAction).toBe('RESTRICT');
    expect(result[0].deleteAction).toBe('SET NULL');
  });

  it('should handle optional fields like id and name', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({
        id: '1',
        name: 'fk_user',
        columnName: 'user_id',
      }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({
        id: '1',
        name: 'fk_user',
        columnName: 'user_id',
      }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toEqual([]);
  });

  it('should handle null referencedSchema', () => {
    const original: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedSchema: null }),
    ];
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'user_id', referencedSchema: null }),
    ];

    const result = getUntrackedForeignKeyRelations(original, updated);

    expect(result).toEqual([]);
  });
  it('should handle both original and updated being undefined', () => {
    const result = getUntrackedForeignKeyRelations(undefined, undefined);

    expect(result).toEqual([]);
  });

  it('should handle both original and updated being empty arrays', () => {
    const result = getUntrackedForeignKeyRelations([], []);

    expect(result).toEqual([]);
  });

  it('should preserve order of updated relations', () => {
    const updated: ForeignKeyRelation[] = [
      createForeignKey({ columnName: 'z_column', referencedTable: 'z_table' }),
      createForeignKey({ columnName: 'a_column', referencedTable: 'a_table' }),
      createForeignKey({ columnName: 'm_column', referencedTable: 'm_table' }),
    ];

    const result = getUntrackedForeignKeyRelations([], updated);

    expect(result.map((fk) => fk.columnName)).toEqual([
      'z_column',
      'a_column',
      'm_column',
    ]);
  });
});
