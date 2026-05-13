import {
  RESOURCE_MEMORY_LOCKED_STEP,
  RESOURCE_MEMORY_STEP,
} from '@/utils/constants/common';
import computeMemoryFromCPU from './computeMemoryFromCPU';

test('derives memory at the 1:2 vCPU-to-GiB ratio using the default 128 MiB step', () => {
  expect(computeMemoryFromCPU(250)).toBe(512);
  expect(computeMemoryFromCPU(500)).toBe(1024);
  expect(computeMemoryFromCPU(750)).toBe(1536);
  expect(computeMemoryFromCPU(1000)).toBe(2048);
  expect(computeMemoryFromCPU(7000)).toBe(14336);
});

test('rounds to the locked 512 MiB step when the ratio is locked', () => {
  expect(computeMemoryFromCPU(250, RESOURCE_MEMORY_LOCKED_STEP)).toBe(512);
  expect(computeMemoryFromCPU(500, RESOURCE_MEMORY_LOCKED_STEP)).toBe(1024);
  expect(computeMemoryFromCPU(1000, RESOURCE_MEMORY_LOCKED_STEP)).toBe(2048);
});

test('produces memory aligned to the active step', () => {
  expect(computeMemoryFromCPU(250) % RESOURCE_MEMORY_STEP).toBe(0);
  expect(
    computeMemoryFromCPU(750, RESOURCE_MEMORY_LOCKED_STEP) %
      RESOURCE_MEMORY_LOCKED_STEP,
  ).toBe(0);
});
