import { expect, test } from 'vitest';
import getAllocatedResources from './getAllocatedResources';

test('should return the total number of allocated resources', () => {
  expect(
    getAllocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      database: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
      },
      hasura: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
      },
      auth: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
      },
      storage: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
      },
    }),
  ).toEqual({ vcpu: 0, memory: 2 });

  expect(
    getAllocatedResources({
      enabled: true,
      totalAvailableVCPU: 1,
      totalAvailableMemory: 2,
      database: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
      },
      hasura: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
      },
      auth: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
      },
      storage: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
      },
    }),
  ).toEqual({ vcpu: 1, memory: 0 });
});
