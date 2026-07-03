import { format } from 'date-fns';
import {
  isDateType,
  isTimestampType,
} from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';

/**
 * Serializes a temporal record-form value into the string PostgreSQL expects
 * for the column's type. Non-temporal values — and the string-based time /
 * interval types — are returned unchanged.
 *
 * Date/time inputs arrive here as a **local** `Date` (the picker / yup cast
 * them), so converting through UTC — as `toUTCString()` did — shifts the value
 * for anyone outside UTC: a `date` rolls to the previous day and a wall-clock
 * `timestamp` moves by the offset. Instead, format from local components:
 *  - `date` → `yyyy-MM-dd` (keeps the picked calendar day),
 *  - `timestamp without time zone` → `yyyy-MM-dd'T'HH:mm:ss` (keeps the typed
 *    wall-clock),
 *  - `timestamp with time zone` → `toISOString()` (the instant is what matters
 *    and round-trips correctly).
 */
export default function serializeTemporalValue(
  value: unknown,
  baseType?: string | null,
): unknown {
  if (!(value instanceof Date)) {
    return value;
  }

  if (isDateType(baseType)) {
    return format(value, 'yyyy-MM-dd');
  }

  if (isTimestampType(baseType)) {
    return baseType === 'timestamp with time zone'
      ? value.toISOString()
      : format(value, "yyyy-MM-dd'T'HH:mm:ss");
  }

  return value;
}
