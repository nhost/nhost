import type { RunService } from '@/features/orgs/projects/common/hooks/useRunServices';
import type { PortTypes } from '@/features/orgs/projects/services/components/ServiceForm/components/PortsFormSection/PortsFormSectionTypes';
import {
  defaultServiceFormValues,
  type ServiceFormInitialData,
} from '@/features/orgs/projects/services/components/ServiceForm/ServiceFormTypes';

// Run services are fetched unresolved, so fields omitted from the stored
// config (e.g. deployed via `nhost run config-deploy`) come back as null.
// The form schema rejects null for these fields without showing an error,
// which silently blocks saving, so fall back to the schema defaults here.
export default function getServiceFormInitialData(
  service: RunService,
): ServiceFormInitialData {
  const healthCheck = service.config?.healthCheck;

  return {
    ...service.config,
    image: service.config?.image?.image,
    pullCredentials: service.config?.image?.pullCredentials,
    subdomain: service.subdomain,
    command: service.config?.command?.map((arg) => ({
      argument: arg,
    })),
    environment: service.config?.environment ?? [],
    ports: (service.config?.ports ?? []).map((item) => ({
      port: item.port,
      type: item.type as PortTypes,
      publish: item.publish ?? false,
      ingresses: item.ingresses,
      rateLimit: item.rateLimit,
    })),
    compute:
      service.config?.resources?.compute ?? defaultServiceFormValues.compute,
    replicas:
      service.config?.resources?.replicas ?? defaultServiceFormValues.replicas,
    autoscaler:
      service.config?.resources?.autoscaler ??
      defaultServiceFormValues.autoscaler,
    storage: service.config?.resources?.storage ?? [],
    healthCheck: healthCheck
      ? {
          port: healthCheck.port,
          initialDelaySeconds: healthCheck.initialDelaySeconds ?? 30,
          probePeriodSeconds: healthCheck.probePeriodSeconds ?? 60,
        }
      : null,
  } as ServiceFormInitialData;
}
