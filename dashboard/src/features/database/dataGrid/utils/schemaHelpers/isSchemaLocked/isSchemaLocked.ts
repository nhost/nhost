import { READ_ONLY_SCHEMAS } from '@/utils/constants/common';

/**
 * Returns `true` if the schema is read-only, `false` otherwise.
 *
 * @param schema - Schema name
 */
export default function isSchemaLocked(schema: string) {
  return READ_ONLY_SCHEMAS.includes(schema);
}
