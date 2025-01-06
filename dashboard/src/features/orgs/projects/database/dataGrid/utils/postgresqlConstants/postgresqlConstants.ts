import type { ColumnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Aliases for PostgreSQL error codes.
 *
 * @docs https://www.postgresql.org/docs/current/errcodes-appendix.html
 */
export const POSTGRESQL_ERROR_CODES = {
  UNIQUE_VIOLATION: '23505',
  SCHEMA_NOT_FOUND: '3F000',
  TABLE_NOT_FOUND: '42P01',
  TABLE_ALREADY_EXISTS: '42P07',
  COLUMNS_NOT_FOUND: '42P10',
  DEPENDENT_OBJECTS_STILL_EXIST: '2BP01',
};

/**
 * Numeric data types in PostgreSQL.
 *
 * @docs https://www.postgresql.org/docs/current/datatype-numeric.html
 */
export const POSTGRESQL_INTEGER_TYPES = [
  'smallint',
  'integer',
  'bigint',
  'smallserial',
  'serial',
  'bigserial',
  'oid',
];

export const POSTGRESQL_DECIMAL_TYPES = [
  'decimal',
  'numeric',
  'real',
  'double precision',
];

/**
 * Character data types in PostgreSQL.
 *
 * @docs https://www.postgresql.org/docs/current/datatype-character.html
 */
export const POSTGRESQL_CHARACTER_TYPES = [
  'character varying',
  'character',
  'text',
];

/**
 * JSON data types in PostgreSQL.
 *
 * @docs https://www.postgresql.org/docs/current/datatype-json.html
 */
export const POSTGRESQL_JSON_TYPES = ['json', 'jsonb'];

/**
 * Date / Time types in PostgreSQL.
 *
 * @docs https://www.postgresql.org/docs/current/datatype-datetime.html
 */
export const POSTGRESQL_DATE_TIME_TYPES = [
  'timestamp without time zone',
  'timestamp with time zone',
  'date',
  'time without time zone',
  'time with time zone',
  'interval',
];

/**
 * Types grouped by category in PostgreSQL.
 */
export const postgresTypeGroups: {
  group: string;
  label: string;
  value: ColumnType;
}[] = [
  { group: 'String types', label: 'text', value: 'text' },
  { group: 'String types', label: 'character varying', value: 'varchar' },
  { group: 'String types', label: 'character', value: 'bpchar' },

  { group: 'UUID types', label: 'uuid', value: 'uuid' },
  { group: 'JSON types', label: 'json', value: 'json' },
  { group: 'JSON types', label: 'jsonb', value: 'jsonb' },
  { group: 'Numeric types', label: 'smallint', value: 'int2' },
  { group: 'Numeric types', label: 'integer', value: 'int4' },
  { group: 'Numeric types', label: 'bigint', value: 'int8' },
  { group: 'Numeric types', label: 'decimal', value: 'decimal' },
  { group: 'Numeric types', label: 'numeric', value: 'numeric' },
  { group: 'Numeric types', label: 'real', value: 'float4' },
  { group: 'Numeric types', label: 'double precision', value: 'float8' },
  { group: 'Boolean types', label: 'boolean', value: 'bool' },
  { group: 'Date types', label: 'date', value: 'date' },
  {
    group: 'Date types',
    label: 'timestamp without time zone',
    value: 'timestamp',
  },
  {
    group: 'Date types',
    label: 'timestamp with time zone',
    value: 'timestamptz',
  },
  { group: 'Date types', label: 'time without time zone', value: 'time' },
  { group: 'Date types', label: 'time with time zone', value: 'timetz' },
  { group: 'Date types', label: 'interval', value: 'interval' },
  { group: 'Binary types', label: 'bytea', value: 'bytea' },
  { group: 'Geometric types', label: 'point', value: 'point' },
  { group: 'Geometric types', label: 'line', value: 'line' },
  { group: 'Geometric types', label: 'lseg', value: 'lseg' },
  { group: 'Geometric types', label: 'box', value: 'box' },
  { group: 'Geometric types', label: 'path', value: 'path' },
  { group: 'Geometric types', label: 'polygon', value: 'polygon' },
  { group: 'Geometric types', label: 'circle', value: 'circle' },
  { group: 'Monetary types', label: 'money', value: 'money' },
  { group: 'Network types', label: 'cidr', value: 'cidr' },
  { group: 'Network types', label: 'inet', value: 'inet' },
  { group: 'Network types', label: 'macaddr', value: 'macaddr' },
  { group: 'Network types', label: 'macaddr8', value: 'macaddr8' },
  { group: 'Object Identifier types', label: 'oid', value: 'oid' },
  {
    group: 'Object Identifier types',
    label: 'relation name',
    value: 'regclass',
  },
  {
    group: 'Object Identifier types',
    label: 'collation name',
    value: 'regcollation',
  },
  {
    group: 'Object Identifier types',
    label: 'text search configuration',
    value: 'regconfig',
  },
  {
    group: 'Object Identifier types',
    label: 'text search dictionary',
    value: 'regdictionary',
  },
  {
    group: 'Object Identifier types',
    label: 'namespace name',
    value: 'regnamespace',
  },
  {
    group: 'Object Identifier types',
    label: 'operator name',
    value: 'regoper',
  },
  {
    group: 'Object Identifier types',
    label: 'operator with argument types',
    value: 'regoperator',
  },
  {
    group: 'Object Identifier types',
    label: 'function name',
    value: 'regproc',
  },
  {
    group: 'Object Identifier types',
    label: 'function with argument types',
    value: 'regprocedure',
  },
  { group: 'Object Identifier types', label: 'role name', value: 'regrole' },
  {
    group: 'Object Identifier types',
    label: 'data type name',
    value: 'regtype',
  },
];

/**
 * Functions available for columns with date / time types in PostgreSQL.
 */
export const dateFunctions = [
  'now()',
  'statement_timestamp()',
  'transaction_timestamp()',
  'clock_timestamp()',
];

/**
 * Relevant functions for PostgreSQL types.
 */
export const postgresFunctions = {
  text: ['version()', 'timeofday()'],
  json: ['json_build_object()', 'json_build_array()'],
  jsonb: ['jsonb_build_object()', 'jsonb_build_array()'],
  date: dateFunctions,
  timestamp: dateFunctions,
  timestamptz: dateFunctions,
  time: dateFunctions,
  timetz: dateFunctions,
  uuid: ['gen_random_uuid()'],
};

/**
 * List of PostgreSQL data types that can be used as identity.
 */
export const identityTypes: ColumnType[] = ['int2', 'int4', 'int8'];
