import type { DatabaseColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';
import convertDataBrowserGridColumnToDatabaseColumn from './convertDataBrowserGridColumnToDatabaseColumn';

test('should convert a data browser column to a database column', () => {
  const column = convertDataBrowserGridColumnToDatabaseColumn({
    id: 'id',
    type: 'text',
    specificType: 'uuid',
    isIdentity: false,
    isUnique: true,
    isPrimary: true,
    isNullable: false,
    defaultValue: {
      value: 'gen_random_uuid()',
      label: 'gen_random_uuid()',
    },
    isDefaultValueCustom: true,
    comment: 'Lorem ipsum',
  });

  expect(column).toMatchObject<DatabaseColumn>({
    id: 'id',
    name: 'id',
    isIdentity: false,
    isUnique: true,
    isPrimary: true,
    isNullable: false,
    type: {
      value: 'uuid',
      label: 'uuid',
    },
    defaultValue: {
      value: 'gen_random_uuid()',
      label: 'gen_random_uuid()',
      custom: true,
    },
    foreignKeyRelation: null,
    comment: 'Lorem ipsum',
    primaryConstraints: [],
    uniqueConstraints: [],
  });
});

test('should convert a string based default value to an autocomplete option', () => {
  const column = convertDataBrowserGridColumnToDatabaseColumn({
    id: 'id',
    type: 'number',
    specificType: 'int4',
    isIdentity: false,
    isUnique: true,
    isPrimary: true,
    isNullable: false,
    defaultValue: '0',
    isDefaultValueCustom: true,
    comment: 'Lorem ipsum',
  });

  expect(column).toMatchObject<DatabaseColumn>({
    id: 'id',
    name: 'id',
    isIdentity: false,
    isUnique: true,
    isPrimary: true,
    isNullable: false,
    type: {
      value: 'int4',
      label: 'int4',
    },
    defaultValue: {
      value: '0',
      label: '0',
      custom: true,
    },
    foreignKeyRelation: null,
    comment: 'Lorem ipsum',
    primaryConstraints: [],
    uniqueConstraints: [],
  });
});
