import type { ServiceFormValues } from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import getFormattedServiceConfig from './getFormattedServiceConfig';

describe('getFormattedServiceConfig', () => {
  it('pghero config should be formatted correctly', () => {
    const pgheroConfig = {
      name: 'pghero',
      image: 'docker.io/ankane/pghero:latest',
      command: [],
      resources: {
        compute: {
          cpu: 125,
          memory: 256,
        },
        storage: [],
        replicas: 1,
      },
      environment: [
        {
          name: 'DATABASE_URL',
          value:
            'postgres://postgres:[PASSWORD]@postgres-service:5432/[SUBDOMAIN]?sslmode=disable',
        },
        {
          name: 'PGHERO_USERNAME',
          value: '[USER]',
        },
        {
          name: 'PGHERO_PASSWORD',
          value: '[PASSWORD]',
        },
      ],
      ports: [
        {
          port: 8080,
          type: 'http',
          publish: true,
        },
      ],
      autoscaler: null,
      compute: {
        cpu: 125,
        memory: 256,
      },
      replicas: 1,
      storage: [],
    } as unknown as ServiceFormValues;

    const formattedConfig = getFormattedServiceConfig({ values: pgheroConfig });

    const expected = {
      name: 'pghero',
      image: {
        image: 'docker.io/ankane/pghero:latest',
      },
      command: [],
      resources: {
        compute: {
          cpu: 125,
          memory: 256,
        },
        storage: [],
        replicas: 1,
        autoscaler: null,
      },
      environment: [
        {
          name: 'DATABASE_URL',
          value:
            'postgres://postgres:[PASSWORD]@postgres-service:5432/[SUBDOMAIN]?sslmode=disable',
        },
        {
          name: 'PGHERO_USERNAME',
          value: '[USER]',
        },
        {
          name: 'PGHERO_PASSWORD',
          value: '[PASSWORD]',
        },
      ],
      ports: [
        {
          port: 8080,
          type: 'http',
          publish: true,
          rateLimit: null,
        },
      ],
      healthCheck: null,
    };

    expect(formattedConfig).toEqual(expected);
  });
});
