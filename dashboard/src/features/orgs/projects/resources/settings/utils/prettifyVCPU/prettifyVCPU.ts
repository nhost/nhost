import { RESOURCE_VCPU_MULTIPLIER } from '@/utils/constants/common';

/**
 * Prettifies a number of vCPUs.
 *
 * @param vcpu - The number of vCPUs.
 * @returns The prettified number of vCPUs.
 */
export default function prettifyVCPU(vcpu: number) {
  return vcpu / RESOURCE_VCPU_MULTIPLIER;
}
