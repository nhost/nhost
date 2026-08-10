/**
 * Returns the key to look up in `postgresFunctions` for a given raw type
 * value, stripping length modifiers (e.g. `varchar(10)` → `varchar`,
 * `numeric(10, 2)` → `numeric`) and lowercasing. Type options are stored by
 * their canonical value (e.g. `character varying`, `timestamptz`), so no alias
 * mapping is needed.
 */
export default function getPostgresFunctionsKey(typeValue?: string): string {
  if (!typeValue) {
    return '';
  }

  return typeValue
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .toLowerCase();
}
