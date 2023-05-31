import type { PrettifyNumberOptions } from '@/utils/prettifyNumber';
import { prettifyNumber } from '@/utils/prettifyNumber';

/**
 * Prettify a size value in bytes.
 *
 * @param size - Size in bytes
 * @param options - Configuration options
 * @returns Prettified size
 */
export default function prettifySize(
  size: number,
  options?: PrettifyNumberOptions,
) {
  return prettifyNumber(size, {
    labels: ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
    separator: ' ',
    ...options,
  });
}
