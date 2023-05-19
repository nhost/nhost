import { expect, test } from 'vitest';
import extractForeignKeyRelation from './extractForeignKeyRelation';

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
    columnName: 'user_id',
    referencedSchema: 'auth',
    referencedTable: 'users',
    referencedColumn: 'id',
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
    columnName: 'user_id',
    referencedSchema: 'auth',
    referencedTable: 'users',
    referencedColumn: 'id',
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
    columnName: 'user_id',
    referencedSchema: 'auth',
    referencedTable: 'users',
    referencedColumn: 'id',
    updateAction: 'SET DEFAULT',
    deleteAction: 'SET NULL',
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
    columnName: 'user_id',
    referencedSchema: null,
    referencedTable: 'users',
    referencedColumn: 'id',
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
    columnName: 'user_id',
    referencedSchema: null,
    referencedTable: 'users',
    referencedColumn: 'id',
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
    columnName: 'user_id',
    referencedSchema: null,
    referencedTable: 'users',
    referencedColumn: 'id',
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
    columnName: 'user_id',
    referencedSchema: null,
    referencedTable: 'users',
    referencedColumn: 'id',
    updateAction: 'NO ACTION',
    deleteAction: 'NO ACTION',
  });
});
