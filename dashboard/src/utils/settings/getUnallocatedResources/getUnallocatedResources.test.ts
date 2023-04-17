import { test } from 'vitest';
import getUnallocatedResources from './getUnallocatedResources';

test('should return 0 for CPU and Memory if all the available resources are allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableVCPU: 4,
      totalAvailableMemory: 8,
      databaseVCPU: 1,
      databaseMemory: 2,
      hasuraVCPU: 1,
      hasuraMemory: 2,
      authVCPU: 1,
      authMemory: 2,
      storageVCPU: 1,
      storageMemory: 2,
    }),
  ).toEqual({ vcpu: 0, memory: 0 });
});

test('should return the unallocated resources if not everything is allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      databaseVCPU: 0,
      databaseMemory: 0.5,
      hasuraVCPU: 0,
      hasuraMemory: 0.5,
      authVCPU: 0,
      authMemory: 0.5,
      storageVCPU: 0,
      storageMemory: 0.5,
    }),
  ).toEqual({ vcpu: 1, memory: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      databaseVCPU: 0.25,
      databaseMemory: 0,
      hasuraVCPU: 0.25,
      hasuraMemory: 0,
      authVCPU: 0.25,
      authMemory: 0,
      storageVCPU: 0.25,
      storageMemory: 0,
    }),
  ).toEqual({ vcpu: 0, memory: 2 });
});

test('should return negative values if services are overallocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      databaseVCPU: 0.5,
      databaseMemory: 0.5,
      hasuraVCPU: 0.5,
      hasuraMemory: 0.5,
      authVCPU: 0.5,
      authMemory: 0.5,
      storageVCPU: 0.5,
      storageMemory: 0.5,
    }),
  ).toEqual({ vcpu: -1, memory: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      databaseVCPU: 0.25,
      databaseMemory: 1,
      hasuraVCPU: 0.25,
      hasuraMemory: 1,
      authVCPU: 0.25,
      authMemory: 1,
      storageVCPU: 0.25,
      storageMemory: 1,
    }),
  ).toEqual({ vcpu: 0, memory: -2 });
});
