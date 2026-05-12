import { expect, test } from 'vitest';
import getAllocatedResources from './getAllocatedResources';

test('should return the total number of allocated resources', () => {
  expect(
    getAllocatedResources({
      enabled: true,
      database: {
        vcpu: 0,
        memory: 0.5,
        lockRatio: true,
      },
      hasura: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
      auth: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
      storage: {
        replicas: 1,
        vcpu: 0,
        memory: 0.5,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
    }),
  ).toEqual({ vcpu: 0, memory: 2 });

  expect(
    getAllocatedResources({
      enabled: true,
      database: {
        vcpu: 0.25,
        memory: 0,
        lockRatio: true,
      },
      hasura: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
      auth: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
      storage: {
        replicas: 1,
        vcpu: 0.25,
        memory: 0,
        autoscale: false,
        maxReplicas: 0,
        lockRatio: true,
      },
    }),
  ).toEqual({ vcpu: 1, memory: 0 });
});
