import { RESOURCE_MEMORY_MULTIPLIER } from '@/utils/constants/common';
import { prettifyNumber } from '@/utils/prettifyNumber';

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
