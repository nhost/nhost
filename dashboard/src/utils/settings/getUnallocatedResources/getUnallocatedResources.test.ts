import { test } from 'vitest';
import getUnallocatedResources from './getUnallocatedResources';

test('should return 0 for CPU and Memory if all the available resources are allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 4,
      totalAvailableMemory: 8,
      databaseCPU: 1,
      databaseMemory: 2,
      hasuraCPU: 1,
      hasuraMemory: 2,
      authCPU: 1,
      authMemory: 2,
      storageCPU: 1,
      storageMemory: 2,
    }),
  ).toEqual({ cpu: 0, memory: 0 });
});

test('should return the unallocated resources if not everything is allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableMemory: 2,
      databaseCPU: 0,
      databaseMemory: 0.5,
      hasuraCPU: 0,
      hasuraMemory: 0.5,
      authCPU: 0,
      authMemory: 0.5,
      storageCPU: 0,
      storageMemory: 0.5,
    }),
  ).toEqual({ cpu: 1, memory: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableMemory: 2,
      databaseCPU: 0.25,
      databaseMemory: 0,
      hasuraCPU: 0.25,
      hasuraMemory: 0,
      authCPU: 0.25,
      authMemory: 0,
      storageCPU: 0.25,
      storageMemory: 0,
    }),
  ).toEqual({ cpu: 0, memory: 2 });
});

test('should return negative values if services are overallocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableMemory: 2,
      databaseCPU: 0.5,
      databaseMemory: 0.5,
      hasuraCPU: 0.5,
      hasuraMemory: 0.5,
      authCPU: 0.5,
      authMemory: 0.5,
      storageCPU: 0.5,
      storageMemory: 0.5,
    }),
  ).toEqual({ cpu: -1, memory: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableMemory: 2,
      databaseCPU: 0.25,
      databaseMemory: 1,
      hasuraCPU: 0.25,
      hasuraMemory: 1,
      authCPU: 0.25,
      authMemory: 1,
      storageCPU: 0.25,
      storageMemory: 1,
    }),
  ).toEqual({ cpu: 0, memory: -2 });
});
