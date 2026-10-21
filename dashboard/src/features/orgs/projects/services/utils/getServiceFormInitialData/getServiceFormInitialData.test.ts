import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import { validationSchema } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import getServiceFormInitialData from './getServiceFormInitialData';

// Shape returned by the API for a service whose stored config omits the
// optional fields, e.g. one deployed with `nhost run config-deploy`.
const serviceWithOmittedFields = {
  id: 'service-id',
  subdomain: 'service-subdomain',
  config: {
    __typename: 'ConfigRunServiceConfig',
    name: 'api',
    image: {
      __typename: 'ConfigRunServiceImage',
      image: 'docker.io/org/api:latest',
      pullCredentials: null,
    },
    command: null,
    environment: null,
    ports: [
      {
        __typename: 'ConfigRunServicePort',
        port: 8080,
        type: 'http',
        publish: null,
        ingresses: null,
        rateLimit: null,
      },
    ],
    resources: {
      __typename: 'ConfigRunServiceResources',
      compute: {
        __typename: 'ConfigComputeResources',
        cpu: 125,
        memory: 256,
      },
      storage: null,
      replicas: 1,
      autoscaler: null,
    },
    healthCheck: {
      __typename: 'ConfigHealthCheck',
      port: 8080,
      initialDelaySeconds: null,
      probePeriodSeconds: null,
    },
  },
} as unknown as RunService;

describe('getServiceFormInitialData', () => {
  it('produces values accepted by the form schema when optional fields are null', async () => {
    const initialData = getServiceFormInitialData(serviceWithOmittedFields);

    await expect(validationSchema.validate(initialData)).resolves.toBeDefined();
  });

  it('falls back to defaults for null fields', () => {
    const initialData = getServiceFormInitialData(serviceWithOmittedFields);

    expect(initialData.environment).toEqual([]);
    expect(initialData.storage).toEqual([]);
    expect(initialData.ports[0].publish).toBe(false);
    expect(initialData.healthCheck).toEqual({
      port: 8080,
      initialDelaySeconds: 30,
      probePeriodSeconds: 60,
    });
  });

  it('keeps stored values', () => {
    const service = {
      ...serviceWithOmittedFields,
      config: {
        ...serviceWithOmittedFields.config,
        environment: [{ name: 'FOO', value: 'bar' }],
        ports: [
          {
            port: 8080,
            type: 'http',
            publish: true,
            ingresses: null,
            rateLimit: null,
          },
        ],
        resources: {
          ...serviceWithOmittedFields.config?.resources,
          storage: [{ name: 'data', path: '/data', capacity: 1 }],
        },
        healthCheck: {
          port: 8080,
          initialDelaySeconds: 10,
          probePeriodSeconds: 20,
        },
      },
    } as unknown as RunService;

    const initialData = getServiceFormInitialData(service);

    expect(initialData.environment).toEqual([{ name: 'FOO', value: 'bar' }]);
    expect(initialData.storage).toEqual([
      { name: 'data', path: '/data', capacity: 1 },
    ]);
    expect(initialData.ports[0].publish).toBe(true);
    expect(initialData.healthCheck).toEqual({
      port: 8080,
      initialDelaySeconds: 10,
      probePeriodSeconds: 20,
    });
  });
});
