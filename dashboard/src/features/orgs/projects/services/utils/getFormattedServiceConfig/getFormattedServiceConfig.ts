import type {
  Port,
  ServiceFormInitialData,
  ServiceFormValues,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';
import type { ConfigRunServiceConfigInsertInput } from '@/utils/__generated__/graphql';
import { removeTypename } from '@/utils/helpers';

export interface GetFormattedServiceConfigProps {
  values: ServiceFormValues;
  initialData?: ServiceFormInitialData;
}

export default function getFormattedServiceConfig({
  values,
  initialData,
}: GetFormattedServiceConfigProps) {
  // Remove any __typename property from the values
  const sanitizedValues = removeTypename(values) as ServiceFormValues;
  const sanitizedInitialDataPorts: Port[] = initialData?.ports
    ? removeTypename(initialData.ports)
    : [];

  const config: ConfigRunServiceConfigInsertInput = {
    name: sanitizedValues.name,
    image: {
      image: sanitizedValues.image,
      pullCredentials: sanitizedValues.pullCredentials,
    },
    command: sanitizedValues.command?.map((arg) => arg.argument),
    resources: {
      compute: {
        cpu: sanitizedValues.compute?.cpu,
        memory: sanitizedValues.compute?.memory,
      },
      storage: sanitizedValues.storage?.map((item) => ({
        name: item.name,
        path: item.path,
        capacity: item.capacity,
      })),
      replicas: sanitizedValues.replicas,
      autoscaler: sanitizedValues.autoscaler
        ? {
            maxReplicas: sanitizedValues.autoscaler?.maxReplicas,
          }
        : null,
    },
    environment: sanitizedValues.environment?.map((item) => ({
      name: item.name,
      value: item.value,
    })),
    ports: sanitizedValues.ports?.map((item) => ({
      port: item.port,
      type: item.type,
      publish: item.publish,
      // biome-ignore lint/suspicious/noExplicitAny: cannot be changed on the UI always null type checking can be skipped.
      ingresses: item.ingresses as any,
      rateLimit:
        sanitizedInitialDataPorts.find(
          (port) => port.port === item.port && port.type === item.type,
          // biome-ignore lint/suspicious/noExplicitAny: cannot be changed on the UI always null type checking can be skipped.
        )?.rateLimit ?? (null as any),
    })),
    healthCheck: sanitizedValues.healthCheck
      ? {
          port: sanitizedValues.healthCheck?.port,
          initialDelaySeconds: sanitizedValues.healthCheck?.initialDelaySeconds,
          probePeriodSeconds: sanitizedValues.healthCheck?.probePeriodSeconds,
        }
      : null,
  };

  return config;
}
