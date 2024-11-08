import type { InputProps } from '@/components/ui/v2/Input';
import type { DataBrowserGridColumn } from '@/features/orgs/projects/database/dataGrid/types/dataBrowser';

/**
 * Get the input type based on the column type.
 *
 * @param column - Column
 * @returns Input type
 */
export default function getInputType<T extends {}>({
  type,
  specificType,
}: Pick<
  DataBrowserGridColumn<T>,
  'type' | 'specificType'
>): InputProps['type'] {
  if (type === 'date' && ['timestamp', 'timestamptz'].includes(specificType)) {
    return 'datetime-local';
  }

  if (type === 'date' && ['time', 'timetz'].includes(specificType)) {
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
