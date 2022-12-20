import type { DataBrowserGridColumn } from '@/types/dataBrowser';
import type { InputProps } from '@/ui/v2/Input';

/**
 * Get the input type based on the column type.
 *
 * @param column - Column
 * @returns Input type
 */
export function getInputType<T extends {}>({
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

export default getInputType;
