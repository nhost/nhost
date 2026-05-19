import { ExternalLink } from 'lucide-react';
import { useFormState, useWatch } from 'react-hook-form';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { MIN_TOTAL_VCPU } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export default function ResourcesFormFooter() {
  const formState = useFormState<ResourceSettingsFormValues>();
  const [enabled, database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['enabled', 'database', 'hasura', 'auth', 'storage']
  >({ name: ['enabled', 'database', 'hasura', 'auth', 'storage'] });

  const isDirty = Object.keys(formState.dirtyFields).length > 0;
  const hasFieldErrors = Object.keys(formState.errors).length > 0;

  let aggregateError: string | null = null;
  if (enabled) {
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

    if (totalCPU < MIN_TOTAL_VCPU) {
      aggregateError = `Total compute must be at least ${MIN_TOTAL_VCPU / RESOURCE_VCPU_MULTIPLIER} vCPU.`;
    } else if (delta > 0) {
      aggregateError = `Add ${prettifyMemory(delta)} of memory to reach the 1:2 ratio.`;
    } else if (delta < 0) {
      aggregateError = `Reduce ${prettifyMemory(-delta)} of memory to reach the 1:2 ratio.`;
    }
  }

  const disabled = !isDirty || hasFieldErrors || !!aggregateError;

  return (
    <div className="flex flex-col items-stretch gap-3 border-t px-4 pt-3.5 sm:flex-row sm:items-center sm:justify-between">
      <p>
        Learn more about{' '}
        <a
          href="https://docs.nhost.io/platform/cloud/compute-resources"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
        >
          Compute Resources
          <ExternalLink className="h-4 w-4" />
        </a>
      </p>

      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
        {aggregateError && (
          <p
            className="text-destructive text-sm sm:text-right"
            role="alert"
            aria-live="polite"
          >
            {aggregateError}
          </p>
        )}

        <ButtonWithLoading
          type="submit"
          disabled={disabled}
          loading={formState.isSubmitting}
          variant="default"
          className="!text-sm+"
          size="sm"
        >
          Save
        </ButtonWithLoading>
      </div>
    </div>
  );
}
