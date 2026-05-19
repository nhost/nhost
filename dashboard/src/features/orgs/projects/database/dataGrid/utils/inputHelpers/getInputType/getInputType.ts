import type { InputProps } from '@/components/ui/v2/Input';
import type { ColumnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

function isTimestampType(specificType?: string | null) {
  if (!specificType) {
    return false;
  }
  return (
    ['timestamp', 'timestamptz'].includes(specificType) ||
    specificType.includes('timestamp')
  );
}

function isTimeType(specificType?: string | null) {
  if (!specificType) {
    return false;
  }
  return (
    ['time', 'timetz'].includes(specificType) ||
    (specificType.includes('time') && !specificType.includes('timestamp'))
  );
}

/**
 * Get the input type based on the column type.
 *
 * @param column - Column
 * @returns Input type
 */
export default function getInputType({
  type,
  specificType,
}: {
  type?: string;
  specificType?: ColumnType | null;
}): InputProps['type'] {
  const specType = specificType as string;

  if (type === 'date' && isTimestampType(specType)) {
    return 'datetime-local';
  }

  if (type === 'date' && isTimeType(specType)) {
    return 'time';
  }

  if (type === 'date' && specType !== 'interval') {
    return 'date';
  }

  if (type === 'number') {
    return 'number';
  }

  return 'text';
}
