import type {
  DatabaseColumn,
  NormalizedQueryDataRow,
} from '@/features/database/dataGrid/types/dataBrowser';
import normalizeDatabaseColumn from './normalizeDatabaseColumn';

const rawColumn: NormalizedQueryDataRow = {
  table_catalog: 'postgres',
  table_schema: 'public',
  table_name: 'test_table',
  column_name: 'id',
  ordinal_position: 1,
  column_default: 'gen_random_uuid()',
  is_nullable: 'NO',
  data_type: 'uuid',
  character_maximum_length: null,
  character_octet_length: null,
  numeric_precision: null,
  numeric_precision_radix: null,
  numeric_scale: null,
  datetime_precision: null,
  interval_type: null,
  interval_precision: null,
  character_set_catalog: null,
  character_set_schema: null,
  character_set_name: null,
  collation_catalog: null,
  collation_schema: null,
  collation_name: null,
  domain_catalog: null,
  domain_schema: null,
  domain_name: null,
  udt_catalog: 'postgres',
  udt_schema: 'pg_catalog',
  udt_name: 'uuid',
  scope_catalog: null,
  scope_schema: null,
  scope_name: null,
  maximum_cardinality: null,
  dtd_identifier: '1',
  is_self_referencing: 'NO',
  is_identity: 'NO',
  identity_generation: null,
  identity_start: null,
  identity_increment: null,
  identity_maximum: null,
  identity_minimum: null,
  identity_cycle: 'NO',
  is_generated: 'NEVER',
  generation_expression: null,
  is_updatable: 'YES',
  is_primary: true,
  is_unique: true,
  column_comment: null,
  unique_constraints: [],
  primary_constraints: ['test_table_pkey'],
  foreign_key_relation: null,
};

test('should normalize a raw database column', () => {
  const column = normalizeDatabaseColumn(rawColumn);

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
      custom: false,
    },
    comment: null,
    primaryConstraints: ['test_table_pkey'],
    uniqueConstraints: [],
    foreignKeyRelation: null,
  });
});

test('should set identity to true if the column is an identity column', () => {
  const rawIdentityColumn: typeof rawColumn = {
    ...rawColumn,
    udt_name: 'int4',
    data_type: 'int4',
    column_default: null,
    is_identity: 'YES',
  };

  const column = normalizeDatabaseColumn(rawIdentityColumn);

  expect(column).toMatchObject<DatabaseColumn>({
    id: 'id',
    name: 'id',
    isIdentity: true,
    isUnique: true,
    isPrimary: true,
    isNullable: false,
    type: {
      value: 'int4',
      label: 'int4',
    },
    defaultValue: null,
    comment: null,
    primaryConstraints: ['test_table_pkey'],
    uniqueConstraints: [],
    foreignKeyRelation: null,
  });
});

test('should set nullable to true if the column is nullable', () => {
  const rawNullableColumn: typeof rawColumn = {
    ...rawColumn,
    is_nullable: 'YES',
  };

  const column = normalizeDatabaseColumn(rawNullableColumn);

  expect(column).toMatchObject<DatabaseColumn>({
    id: 'id',
    name: 'id',
    isIdentity: false,
    isUnique: true,
    isPrimary: true,
    isNullable: true,
    type: {
      value: 'uuid',
      label: 'uuid',
    },
    defaultValue: {
      value: 'gen_random_uuid()',
      label: 'gen_random_uuid()',
      custom: false,
    },
    comment: null,
    primaryConstraints: ['test_table_pkey'],
    uniqueConstraints: [],
    foreignKeyRelation: null,
  });
});
