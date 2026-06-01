import type { postgresFunctions } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';

/**
 * Aliases mapping common type names (or free-typed custom types) to the
 * canonical key used in `postgresFunctions`. Lets custom-length types like
 * `varchar(10)` or `character varying(255)` pick up the same default-value
 * options as their canonical form.
 */
const TYPE_ALIASES: Record<string, keyof typeof postgresFunctions> = {
  varchar: 'character varying',
};

/**
 * Returns the key to look up in `postgresFunctions` for a given raw type
 * value, stripping length modifiers (e.g. `varchar(10)` → `varchar`) and
 * mapping aliases to their canonical form.
 */
export default function getPostgresFunctionsKey(typeValue?: string): string {
  if (!typeValue) {
    return '';
  }

  const base = typeValue
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
    .toLowerCase();
  return TYPE_ALIASES[base] ?? base;
}
