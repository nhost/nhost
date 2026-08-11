import { expect, test } from 'vitest';
import extractForeignKeyRelation from './extractForeignKeyRelation';

describe('extractForeignKeyRelation', () => {
  test('should return null if there is no match', () => {
    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'something_that_is_not_a_foreign_key',
      ),
    ).toBe(null);
  });

  test('should extract data from a raw foreign key constraint', () => {
    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: 'auth',
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    });

    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: 'auth',
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'CASCADE',
      deleteAction: 'CASCADE',
    });

    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES auth.users(id) ON UPDATE SET DEFAULT ON DELETE SET NULL',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: 'auth',
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'SET DEFAULT',
      deleteAction: 'SET NULL',
    });
  });

  test('should extract data from a composite foreign key constraint', () => {
    expect(
      extractForeignKeyRelation(
        'child_a_id_b_id_fkey',
        'FOREIGN KEY (a_id, b_id) REFERENCES public.parent(x_id, y_id) ON UPDATE CASCADE ON DELETE RESTRICT',
      ),
    ).toMatchObject({
      name: 'child_a_id_b_id_fkey',
      columns: ['a_id', 'b_id'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x_id', 'y_id'],
      updateAction: 'CASCADE',
      deleteAction: 'RESTRICT',
    });
  });

  test('should extract a composite foreign key with quoted identifiers and strip the quotes', () => {
    expect(
      extractForeignKeyRelation(
        'child_a_id_colB_fkey',
        'FOREIGN KEY (a_id, "colB") REFERENCES public.parent("x_id", "colY") ON UPDATE CASCADE ON DELETE CASCADE',
      ),
    ).toMatchObject({
      name: 'child_a_id_colB_fkey',
      columns: ['a_id', 'colB'],
      referencedSchema: 'public',
      referencedTable: 'parent',
      referencedColumns: ['x_id', 'colY'],
      updateAction: 'CASCADE',
      deleteAction: 'CASCADE',
    });
  });

  test("should return column's name with a capital letter without quotes", () => {
    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY ("userId") REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['userId'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    });
  });
  test('should return null as referenced schema if it is not present', () => {
    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT ON DELETE RESTRICT',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'RESTRICT',
    });
  });

  test('should return NO ACTION for update and delete actions if they are not present', () => {
    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE RESTRICT',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'RESTRICT',
      deleteAction: 'NO ACTION',
    });

    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'NO ACTION',
      deleteAction: 'RESTRICT',
    });

    expect(
      extractForeignKeyRelation(
        'table_id_fkey',
        'FOREIGN KEY (user_id) REFERENCES users(id)',
      ),
    ).toMatchObject({
      name: 'table_id_fkey',
      columns: ['user_id'],
      referencedSchema: null,
      referencedTable: 'users',
      referencedColumns: ['id'],
      updateAction: 'NO ACTION',
      deleteAction: 'NO ACTION',
    });
  });
});
