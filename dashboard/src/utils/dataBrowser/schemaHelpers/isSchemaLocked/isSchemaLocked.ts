import { READ_ONLY_SCHEMAS } from '@/utils/CONSTANTS';

/**
 * Returns `true` if the schema is read-only, `false` otherwise.
 *
 * @param schema - Schema name
 */
export function isSchemaLocked(schema: string) {
  return READ_ONLY_SCHEMAS.includes(schema);
}

export default isSchemaLocked;
