import type { InputProps } from '@/components/ui/v2/Input';
import type { ColumnType } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

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
  if (
    type === 'date' &&
    ['timestamp', 'timestamptz'].includes(specificType as string)
  ) {
    return 'datetime-local';
  }

  if (type === 'date' && ['time', 'timetz'].includes(specificType as string)) {
    return 'time';
  }

  if (type === 'date' && specificType !== 'interval') {
    return 'date';
  }

  if (type === 'number') {
    return 'number';
  }

  return 'text';
}
