import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { cn } from '@/lib/utils';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

export default function RatioBanner() {
  const values =
    useWatch<ResourceSettingsFormValues>() as ResourceSettingsFormValues;

  if (!values?.enabled) {
    return null;
  }

  const totalCPU =
    (values.database?.vcpu ?? 0) +
    (values.hasura?.vcpu ?? 0) +
    (values.auth?.vcpu ?? 0) +
    (values.storage?.vcpu ?? 0);

  const totalMemory =
    (values.database?.memory ?? 0) +
    (values.hasura?.memory ?? 0) +
    (values.auth?.memory ?? 0) +
    (values.storage?.memory ?? 0);

  const expectedMemory =
    (totalCPU / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_MEMORY_RATIO *
    RESOURCE_MEMORY_MULTIPLIER;

  const delta = expectedMemory - totalMemory;

  const balanced = delta === 0;
  const underAllocated = delta > 0;

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        balanced
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200'
          : 'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200',
      )}
    >
      {balanced ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <div className="flex flex-col gap-0.5">
        {balanced && (
          <span>Total memory matches total vCPU at the 1:2 ratio.</span>
        )}
        {underAllocated && (
          <>
            <span className="font-medium">
              {prettifyMemory(delta)} of memory unallocated
            </span>
            <span className="text-xs opacity-90">
              Total memory must equal 2× total vCPU. Add memory to a service or
              reduce CPU.
            </span>
          </>
        )}
        {!balanced && !underAllocated && (
          <>
            <span className="font-medium">
              {prettifyMemory(-delta)} of memory over the 1:2 ratio
            </span>
            <span className="text-xs opacity-90">
              Reduce memory on a service or allocate more CPU.
            </span>
          </>
        )}
      </div>
    </div>
  );
}
