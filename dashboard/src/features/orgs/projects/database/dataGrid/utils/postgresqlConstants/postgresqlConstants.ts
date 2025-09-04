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

export const POSTGRESQL_DECIMAL_TYPES = ['numeric', 'real', 'double precision'];

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
  order: number;
}[] = [
  { group: 'String types', label: 'text', value: 'text', order: 1 },
  {
    group: 'String types',
    label: 'character varying',
    value: 'character varying',
    order: 2,
  },
  { group: 'String types', label: 'character', value: 'bpchar', order: 3 },

  { group: 'UUID types', label: 'uuid', value: 'uuid', order: 4 },
  { group: 'JSON types', label: 'json', value: 'json', order: 5 },
  { group: 'JSON types', label: 'jsonb', value: 'jsonb', order: 6 },
  { group: 'Numeric types', label: 'smallint', value: 'int2', order: 7 },
  { group: 'Numeric types', label: 'integer', value: 'int4', order: 8 },
  { group: 'Numeric types', label: 'bigint', value: 'int8', order: 9 },
  { group: 'Numeric types', label: 'numeric', value: 'numeric', order: 10 },
  { group: 'Numeric types', label: 'real', value: 'float4', order: 11 },
  {
    group: 'Numeric types',
    label: 'double precision',
    value: 'float8',
    order: 12,
  },
  { group: 'Boolean types', label: 'boolean', value: 'bool', order: 13 },
  { group: 'Date types', label: 'date', value: 'date', order: 14 },
  {
    group: 'Date types',
    label: 'timestamp without time zone',
    value: 'timestamp',
    order: 15,
  },
  {
    group: 'Date types',
    label: 'timestamp with time zone',
    value: 'timestamptz',
    order: 16,
  },
  {
    group: 'Date types',
    label: 'time without time zone',
    value: 'time',
    order: 17,
  },
  {
    group: 'Date types',
    label: 'time with time zone',
    value: 'timetz',
    order: 18,
  },
  { group: 'Date types', label: 'interval', value: 'interval', order: 19 },
  { group: 'Binary types', label: 'bytea', value: 'bytea', order: 20 },
  { group: 'Geometric types', label: 'point', value: 'point', order: 21 },
  { group: 'Geometric types', label: 'line', value: 'line', order: 22 },
  { group: 'Geometric types', label: 'lseg', value: 'lseg', order: 23 },
  { group: 'Geometric types', label: 'box', value: 'box', order: 24 },
  { group: 'Geometric types', label: 'path', value: 'path', order: 25 },
  { group: 'Geometric types', label: 'polygon', value: 'polygon', order: 26 },
  { group: 'Geometric types', label: 'circle', value: 'circle', order: 27 },
  { group: 'Monetary types', label: 'money', value: 'money', order: 28 },
  { group: 'Network types', label: 'cidr', value: 'cidr', order: 29 },
  { group: 'Network types', label: 'inet', value: 'inet', order: 30 },
  { group: 'Network types', label: 'macaddr', value: 'macaddr', order: 31 },
  { group: 'Network types', label: 'macaddr8', value: 'macaddr8', order: 32 },
  { group: 'Object Identifier types', label: 'oid', value: 'oid', order: 33 },
  {
    group: 'Object Identifier types',
    label: 'relation name',
    value: 'regclass',
    order: 34,
  },
  {
    group: 'Object Identifier types',
    label: 'collation name',
    value: 'regcollation',
    order: 35,
  },
  {
    group: 'Object Identifier types',
    label: 'text search configuration',
    value: 'regconfig',
    order: 36,
  },
  {
    group: 'Object Identifier types',
    label: 'text search dictionary',
    value: 'regdictionary',
    order: 37,
  },
  {
    group: 'Object Identifier types',
    label: 'namespace name',
    value: 'regnamespace',
    order: 38,
  },
  {
    group: 'Object Identifier types',
    label: 'operator name',
    value: 'regoper',
    order: 39,
  },
  {
    group: 'Object Identifier types',
    label: 'operator with argument types',
    value: 'regoperator',
    order: 40,
  },
  {
    group: 'Object Identifier types',
    label: 'function name',
    value: 'regproc',
    order: 41,
  },
  {
    group: 'Object Identifier types',
    label: 'function with argument types',
    value: 'regprocedure',
    order: 42,
  },
  {
    group: 'Object Identifier types',
    label: 'role name',
    value: 'regrole',
    order: 43,
  },
  {
    group: 'Object Identifier types',
    label: 'data type name',
    value: 'regtype',
    order: 44,
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

export const RECOVERY_RETENTION_PERIOD_7 = 7;
