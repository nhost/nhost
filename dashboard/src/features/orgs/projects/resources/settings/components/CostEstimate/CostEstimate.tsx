import { Info } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { calculateBillableResources } from '@/features/orgs/projects/resources/settings/utils/calculateBillableResources';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_PRICE_PER_MINUTE,
} from '@/utils/constants/common';

export default function CostEstimate() {
  const values =
    useWatch<ResourceSettingsFormValues>() as ResourceSettingsFormValues;

  const billable = calculateBillableResources(
    { replicas: 1, vcpu: values?.database?.vcpu },
    { replicas: values?.hasura?.replicas, vcpu: values?.hasura?.vcpu },
    { replicas: values?.auth?.replicas, vcpu: values?.auth?.vcpu },
    { replicas: values?.storage?.replicas, vcpu: values?.storage?.vcpu },
  );

  const vcpu = values?.enabled ? billable.vcpu : 0;
  const perMinute =
    (vcpu / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE_PER_MINUTE;
  const perMonth = (vcpu / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-1.5">
        <span className="font-medium text-sm">Estimated cost</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <Info
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-label="Pricing info"
              />
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Billed per vCPU per minute. Memory is included at the 1:2 ratio.
            Your organization's $15/mo credits cover both shared and dedicated
            compute.
          </TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-2xl tabular-nums">
            ${perMinute.toFixed(4)}
          </span>
          <span className="text-muted-foreground text-xs">/ min</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-semibold text-2xl tabular-nums">
            ${perMonth.toFixed(2)}
          </span>
          <span className="text-muted-foreground text-xs">/ month</span>
        </div>
      </div>

      <div className="text-muted-foreground text-xs">
        Based on{' '}
        <span className="font-medium text-foreground">
          {prettifyVCPU(vcpu).toFixed(2)} vCPU
        </span>{' '}
        billable (replicas included).
      </div>
    </div>
  );
}
