import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export default function RatioBanner() {
  const [enabled, database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['enabled', 'database', 'hasura', 'auth', 'storage']
  >({ name: ['enabled', 'database', 'hasura', 'auth', 'storage'] });

  if (!enabled) {
    return null;
  }

  const totalCPU =
    (database?.vcpu ?? 0) +
    (hasura?.vcpu ?? 0) * (hasura?.replicas ?? 1) +
    (auth?.vcpu ?? 0) * (auth?.replicas ?? 1) +
    (storage?.vcpu ?? 0) * (storage?.replicas ?? 1);

  const totalMemory =
    (database?.memory ?? 0) +
    (hasura?.memory ?? 0) * (hasura?.replicas ?? 1) +
    (auth?.memory ?? 0) * (auth?.replicas ?? 1) +
    (storage?.memory ?? 0) * (storage?.replicas ?? 1);

  const expectedMemory =
    (totalCPU / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_MEMORY_RATIO *
    RESOURCE_MEMORY_MULTIPLIER;

  const delta = expectedMemory - totalMemory;

  const balanced = delta === 0;
  const underAllocated = delta > 0;

  if (balanced) {
    return (
      <Alert variant="success" role="status">
        <CheckCircle2 className="size-5" />
        <AlertDescription className="text-muted-foreground">
          Total memory matches total vCPU at the 1:2 ratio.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning" role="status">
      <AlertTriangle className="size-9" />
      {underAllocated ? (
        <>
          <AlertTitle>{prettifyMemory(delta)} of memory unallocated</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Total memory must equal 2× total vCPU. Add memory to a service or
            reduce CPU.
          </AlertDescription>
        </>
      ) : (
        <>
          <AlertTitle>
            {prettifyMemory(-delta)} of memory over the 1:2 ratio
          </AlertTitle>
          <AlertDescription className="text-muted-foreground">
            Reduce memory on a service or allocate more CPU.
          </AlertDescription>
        </>
      )}
    </Alert>
  );
}
