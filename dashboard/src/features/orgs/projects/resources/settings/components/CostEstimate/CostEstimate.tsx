import { AlertTriangle, Info } from 'lucide-react';
import { useWatch } from 'react-hook-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_PRICE_PER_MINUTE,
} from '@/utils/constants/common';

export default function CostEstimate() {
  const [enabled, database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['enabled', 'database', 'hasura', 'auth', 'storage']
  >({ name: ['enabled', 'database', 'hasura', 'auth', 'storage'] });

  const generic = [hasura, auth, storage];

  const billableVCPU = !enabled
    ? 0
    : (database?.vcpu ?? 0) +
      generic.reduce(
        (sum, service) => sum + (service?.vcpu ?? 0) * (service?.replicas ?? 1),
        0,
      );

  const autoscaleExtraVCPU = !enabled
    ? 0
    : generic.reduce((sum, service) => {
        if (!service?.autoscale) {
          return sum;
        }
        const headroom = (service.maxReplicas ?? 0) - (service.replicas ?? 1);
        if (headroom <= 0) {
          return sum;
        }
        return sum + (service.vcpu ?? 0) * headroom;
      }, 0);

  const hasAutoscaler =
    !!enabled && generic.some((service) => service?.autoscale);

  const perMinute =
    (billableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE_PER_MINUTE;
  const perMonth =
    (billableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

  const extraPerMinute =
    (autoscaleExtraVCPU / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_PRICE_PER_MINUTE;
  const extraPerMonth =
    (autoscaleExtraVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE;

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
            Your organization&apos;s $15/mo credits cover both shared and
            dedicated compute.
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
          {prettifyVCPU(billableVCPU).toFixed(2)} vCPU
        </span>{' '}
        billable (replicas included).
      </div>

      {hasAutoscaler && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-amber-900 text-xs dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Autoscaler can vary the bill</span>
            <span className="opacity-90">
              Each extra replica is billed by the minute while it runs. Bursts
              to max replicas can add up to{' '}
              <span className="font-medium tabular-nums">
                ${extraPerMinute.toFixed(4)}/min
              </span>{' '}
              (~
              <span className="font-medium tabular-nums">
                ${extraPerMonth.toFixed(2)}/mo
              </span>
              ) on top of the base cost.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
