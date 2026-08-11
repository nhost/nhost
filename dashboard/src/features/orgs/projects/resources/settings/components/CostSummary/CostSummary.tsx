import { ArrowRight, Info } from 'lucide-react';
import { useFormContext, useWatch } from 'react-hook-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { calculateBillableResources } from '@/features/orgs/projects/resources/settings/utils/calculateBillableResources';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { cn } from '@/lib/utils';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
} from '@/utils/constants/common';

export interface CostSummaryProps {
  initialCost: number;
}

export default function CostSummary({ initialCost }: CostSummaryProps) {
  const isPlatform = useIsPlatform();
  const { formState } = useFormContext<ResourceSettingsFormValues>();

  const [database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['database', 'hasura', 'auth', 'storage']
  >({ name: ['database', 'hasura', 'auth', 'storage'] });

  const billable = calculateBillableResources(
    { replicas: 1, vcpu: database?.vcpu, memory: database?.memory },
    {
      replicas: hasura?.replicas,
      vcpu: hasura?.vcpu,
      memory: hasura?.memory,
    },
    { replicas: auth?.replicas, vcpu: auth?.vcpu, memory: auth?.memory },
    {
      replicas: storage?.replicas,
      vcpu: storage?.vcpu,
      memory: storage?.memory,
    },
  );

  const newCost = isPlatform
    ? (billable.vcpu / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE
    : 0;
  const delta = newCost - initialCost;
  const isDirty = Object.keys(formState.dirtyFields).length > 0;

  return (
    <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5 text-sm">
        <div>
          <span className="text-muted-foreground">Total: </span>
          <span className="font-medium tabular-nums">
            {prettifyVCPU(billable.vcpu).toFixed(2)} vCPU ·{' '}
            {prettifyMemory(billable.memory)}
          </span>
        </div>
        {isPlatform && (
          <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <span>Billed at $0.0012/vCPU/min</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Info className="h-3.5 w-3.5" aria-label="Billing info" />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                Equivalent to ${RESOURCE_VCPU_PRICE}/vCPU/month. Your
                organization&apos;s $15/mo credits cover both shared and
                dedicated compute.
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {isPlatform && (
        <div className="flex items-center gap-2 text-sm tabular-nums">
          {isDirty && initialCost !== newCost ? (
            <>
              <span className="text-muted-foreground line-through">
                ${initialCost.toFixed(2)}/mo
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">${newCost.toFixed(2)}/mo</span>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 font-medium text-xs',
                  delta > 0
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
                )}
              >
                {delta > 0 ? '+' : ''}${delta.toFixed(2)}/mo
              </span>
            </>
          ) : (
            <span className="font-semibold">${newCost.toFixed(2)}/mo</span>
          )}
        </div>
      )}
    </div>
  );
}
