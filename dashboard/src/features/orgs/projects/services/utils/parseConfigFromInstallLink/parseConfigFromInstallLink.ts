import { type RunServiceConfig } from '@/features/orgs/projects/common/hooks/useRunServices';
import { type PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import {
  defaultServiceFormValues,
  type ServiceFormInitialData,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';

export default function parseConfigFromInstallLink(
  base64Config: string,
): ServiceFormInitialData {
  const decodedConfig = atob(base64Config);
  const parsedConfig: RunServiceConfig = JSON.parse(decodedConfig);
  const initialData = {
    ...parsedConfig,
    autoscaler:
      parsedConfig?.resources?.autoscaler ??
      defaultServiceFormValues.autoscaler,
    compute:
      parsedConfig?.resources?.compute ?? defaultServiceFormValues.compute,
    image: parsedConfig?.image?.image,
    command: parsedConfig?.command?.map((arg) => ({
      argument: arg,
    })),
    environment:
      parsedConfig?.environment?.map((env) => ({
        name: env.name,
        value: env.value,
      })) ?? undefined,
    healthCheck: parsedConfig?.healthCheck
      ? {
          port: parsedConfig.healthCheck.port ?? 3000,
          initialDelaySeconds:
            parsedConfig.healthCheck.initialDelaySeconds ?? 30,
          probePeriodSeconds: parsedConfig.healthCheck.probePeriodSeconds ?? 60,
        }
      : undefined,
    ports:
      parsedConfig?.ports?.map((item) => ({
        port: item.port ?? 3000,
        type: item.type as PortTypes,
        publish: Boolean(item.publish),
      })) ?? [],
    replicas: parsedConfig?.resources?.replicas,
    storage: parsedConfig?.resources?.storage ?? undefined,
  };

  return initialData;
}
