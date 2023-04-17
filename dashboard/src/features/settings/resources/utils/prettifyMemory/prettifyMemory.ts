import { RESOURCE_MEMORY_MULTIPLIER } from '@/utils/CONSTANTS';
import { prettifyNumber } from '@/utils/common/prettifyNumber';

/**
 * Prettifies a number of memory.
 *
 * @param vcpu - The number of memory.
 * @returns The prettified number of memory.
 */
export default function prettifyMemory(memory: number) {
  return prettifyNumber(memory, {
    labels: ['MiB'],
    numberOfDecimals: 3,
    separator: ' ',
    multiplier: RESOURCE_MEMORY_MULTIPLIER,
  });
}
