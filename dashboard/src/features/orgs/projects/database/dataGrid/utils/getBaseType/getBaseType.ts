/**
 * Reduces a PostgreSQL type string to its bare base type name by removing a
 * trailing array marker (`[]`) and length / precision modifiers (`(…)`), which
 * may appear at the end (`character varying(12)`, `numeric(10,2)`) or in the
 * middle (`timestamp(3) with time zone`).
 *
 * Casing is preserved so custom (and schema-qualified) type names survive
 * untouched. Parentheses inside a double-quoted identifier are part of the
 * name — a type can legally be named `"my(type)"` — so quoted names keep
 * everything but a trailing array marker, since built-in types that carry a
 * real modifier are never quoted.
 *
 * @example
 * getBaseType('character varying(12)')       // 'character varying'
 * getBaseType('integer[]')                   // 'integer'
 * getBaseType('timestamp(3) with time zone') // 'timestamp with time zone'
 * getBaseType('public.my_status')            // 'public.my_status'
 * getBaseType('"my(type)"')                  // '"my(type)"'
 */
export default function getBaseType(specificType?: string | null): string {
  if (!specificType) {
    return '';
  }

  const withoutArray = specificType.replace(/(\[\])+$/, '');

  if (withoutArray.includes('"')) {
    return withoutArray.trim();
  }

  return withoutArray
    .replace(/\([^)]*\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
