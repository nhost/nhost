import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_MEMORY_STEP,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export default function computeMemoryFromCPU(
  vcpu: number,
  step: number = RESOURCE_MEMORY_STEP,
): number {
  const exactMemory =
    (vcpu / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_MEMORY_RATIO *
    RESOURCE_MEMORY_MULTIPLIER;
  return Math.round(exactMemory / step) * step;
}
