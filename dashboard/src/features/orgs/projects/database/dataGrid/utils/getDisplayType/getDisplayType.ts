import { getBaseType } from '@/features/orgs/projects/database/dataGrid/utils/getBaseType';

/**
 * Maps the type spellings used across the app to a single canonical display
 * name per type, so the same column reads identically in the column editor
 * (short `udt_name` forms) and the data browser (`FORMAT_TYPE` long forms).
 *
 * Two rules are folded together:
 *  - short internal names normalize to their readable SQL name
 *    (`int4` → `integer`, `bool` → `boolean`), and
 *  - genuinely verbose multi-word names are shortened
 *    (`timestamp with time zone` → `timestamptz`, `character varying` →
 *    `varchar`).
 *
 * `double precision` is intentionally left long, and anything not listed
 * (custom types, geometric / network / object-identifier types, …) passes
 * through unchanged — including its original casing.
 */
const TYPE_DISPLAY_NAMES: Record<string, string> = {
  int2: 'smallint',
  int4: 'integer',
  int8: 'bigint',
  float4: 'real',
  float8: 'double precision',
  bool: 'boolean',
  bpchar: 'character',
  'character varying': 'varchar',
  'timestamp with time zone': 'timestamptz',
  'timestamp without time zone': 'timestamp',
  'time with time zone': 'timetz',
  'time without time zone': 'time',
};

/**
 * Builds the user-facing label for a column type from its `specificType`,
 * preserving length / precision modifiers (`varchar(12)`) and array suffixes
 * (`integer[]`). Fractional-seconds precision on timestamp / time types is
 * dropped (it sits mid-name and is purely informational), matching what the
 * column editor offers.
 *
 * @example
 * getDisplayType('timestamp with time zone') // 'timestamptz'
 * getDisplayType('character varying(12)')    // 'varchar(12)'
 * getDisplayType('integer[]')                // 'integer[]'
 * getDisplayType('int4')                     // 'integer'
 * getDisplayType('public.my_status')         // 'public.my_status'
 */
export default function getDisplayType(specificType?: string | null): string {
  if (!specificType) {
    return '';
  }

  const isArray = /(\[\])+$/.test(specificType);
  const withoutArray = specificType.replace(/(\[\])+$/, '');
  const trailingModifier = withoutArray.match(/\([^)]*\)$/)?.[0] ?? '';

  const base = getBaseType(specificType);
  const displayBase = TYPE_DISPLAY_NAMES[base] ?? base;

  return `${displayBase}${trailingModifier}${isArray ? '[]' : ''}`;
}
