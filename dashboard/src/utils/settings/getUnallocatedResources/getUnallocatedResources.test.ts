import { test } from 'vitest';
import getUnallocatedResources from './getUnallocatedResources';

test('should return 0 for CPU and RAM if they are allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 4,
      totalAvailableRAM: 8,
      databaseCPU: 1,
      databaseRAM: 2,
      hasuraCPU: 1,
      hasuraRAM: 2,
      authCPU: 1,
      authRAM: 2,
      storageCPU: 1,
      storageRAM: 2,
    }),
  ).toEqual({ cpu: 0, ram: 0 });
});

test('should return the unallocated resources if not everything is allocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableRAM: 2,
      databaseCPU: 0,
      databaseRAM: 0.5,
      hasuraCPU: 0,
      hasuraRAM: 0.5,
      authCPU: 0,
      authRAM: 0.5,
      storageCPU: 0,
      storageRAM: 0.5,
    }),
  ).toEqual({ cpu: 1, ram: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableRAM: 2,
      databaseCPU: 0.25,
      databaseRAM: 0,
      hasuraCPU: 0.25,
      hasuraRAM: 0,
      authCPU: 0.25,
      authRAM: 0,
      storageCPU: 0.25,
      storageRAM: 0,
    }),
  ).toEqual({ cpu: 0, ram: 2 });
});

test('should return negative values if services are overallocated', () => {
  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableRAM: 2,
      databaseCPU: 0.5,
      databaseRAM: 0.5,
      hasuraCPU: 0.5,
      hasuraRAM: 0.5,
      authCPU: 0.5,
      authRAM: 0.5,
      storageCPU: 0.5,
      storageRAM: 0.5,
    }),
  ).toEqual({ cpu: -1, ram: 0 });

  expect(
    getUnallocatedResources({
      enabled: true,
      totalAvailableCPU: 1,
      totalAvailableRAM: 2,
      databaseCPU: 0.25,
      databaseRAM: 1,
      hasuraCPU: 0.25,
      hasuraRAM: 1,
      authCPU: 0.25,
      authRAM: 1,
      storageCPU: 0.25,
      storageRAM: 1,
    }),
  ).toEqual({ cpu: 0, ram: -2 });
});
