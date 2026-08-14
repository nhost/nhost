import { POSTGRESQL_NUMERIC_TYPES } from '@/features/orgs/projects/database/dataGrid/utils/postgresqlConstants';
import {
  isDateType,
  isTimestampType,
  isTimeType,
} from '@/features/orgs/projects/database/dataGrid/utils/temporalTypeHelpers';

/**
 * Picks the HTML input type for a scalar column from its canonical `baseType`:
 * `datetime-local` for timestamps, `time` for time-of-day types, `date` for
 * calendar dates, `number` for numeric types, and `text` for everything else
 * (including `interval`, which has no native control). Array columns do reach
 * this function, but the returned type is unused: the input group forces them
 * to a multiline textarea, where the `type` prop has no effect.
 */
export default function getInputType(
  baseType?: string | null,
): 'datetime-local' | 'time' | 'date' | 'number' | 'text' {
  if (isTimestampType(baseType)) {
    return 'datetime-local';
  }

  if (isTimeType(baseType)) {
    return 'time';
  }

  if (isDateType(baseType)) {
    return 'date';
  }

  if (POSTGRESQL_NUMERIC_TYPES.includes(baseType ?? '')) {
    return 'number';
  }

  return 'text';
}
