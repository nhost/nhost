import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useProPlan } from '@/features/orgs/projects/common/hooks/useProPlan';
import { calculateBillableResources } from '@/features/orgs/projects/resources/settings/utils/calculateBillableResources';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import {
  RESOURCE_VCPU_MULTIPLIER,
  RESOURCE_VCPU_PRICE,
  RESOURCE_VCPU_PRICE_PER_MINUTE,
} from '@/utils/constants/common';

export interface ResourcesConfirmationDialogProps {
  formValues: ResourceSettingsFormValues;
  onCancel: () => void;
  onSubmit: () => Promise<void>;
}

interface ServiceLineProps {
  label: string;
  vcpu: number;
  memory: number;
  replicas?: number;
}

function ServiceLine({ label, vcpu, memory, replicas }: ServiceLineProps) {
  return (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-muted-foreground tabular-nums">
        {prettifyVCPU(vcpu)} vCPU + {prettifyMemory(memory)}
        {replicas && replicas > 1 ? ` (${replicas} replicas)` : ''}
      </span>
    </div>
  );
}

export default function ResourcesConfirmationDialog({
  formValues,
  onCancel,
  onSubmit,
}: ResourcesConfirmationDialogProps) {
  const { data: proPlan, loading, error } = useProPlan();
  const { enabled } = formValues;

  const billable = calculateBillableResources(
    {
      replicas: 1,
      vcpu: formValues.database?.vcpu,
      memory: formValues.database?.memory,
    },
    {
      replicas: formValues.hasura?.replicas,
      vcpu: formValues.hasura?.vcpu,
      memory: formValues.hasura?.memory,
    },
    {
      replicas: formValues.auth?.replicas,
      vcpu: formValues.auth?.vcpu,
      memory: formValues.auth?.memory,
    },
    {
      replicas: formValues.storage?.replicas,
      vcpu: formValues.storage?.vcpu,
      memory: formValues.storage?.memory,
    },
  );

  const totalBillableVCPU = enabled ? billable.vcpu : 0;
  const totalBillableMemory = enabled ? billable.memory : 0;

  const updatedPrice = enabled
    ? (totalBillableVCPU / RESOURCE_VCPU_MULTIPLIER) * RESOURCE_VCPU_PRICE
    : proPlan?.price;

  if (!loading && !proPlan) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Couldn&apos;t load the plan for this project. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  if (error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-6 px-6 pb-6">
      {totalBillableVCPU > 0 ? (
        <p className="text-center text-sm">
          Please allow some time for the selected resources to take effect.
        </p>
      ) : (
        <p className="text-center text-sm">
          By confirming this you will go back to the original shared resources
          included in the {proPlan?.name} plan.
        </p>
      )}

      <div className="grid grid-flow-row gap-4">
        <div className="grid grid-flow-row gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">Dedicated Resources</span>
            <span className="text-sm tabular-nums">
              $
              {(
                (totalBillableVCPU / RESOURCE_VCPU_MULTIPLIER) *
                RESOURCE_VCPU_PRICE_PER_MINUTE
              ).toFixed(4)}
              /min
            </span>
          </div>

          <div className="grid grid-flow-row gap-1">
            <ServiceLine
              label="PostgreSQL Database"
              vcpu={enabled ? formValues.database.vcpu : 0}
              memory={enabled ? formValues.database.memory : 0}
            />
            <ServiceLine
              label="Hasura GraphQL"
              vcpu={enabled ? formValues.hasura.vcpu : 0}
              memory={enabled ? formValues.hasura.memory : 0}
              replicas={enabled ? formValues.hasura.replicas : 1}
            />
            <ServiceLine
              label="Auth"
              vcpu={enabled ? formValues.auth.vcpu : 0}
              memory={enabled ? formValues.auth.memory : 0}
              replicas={enabled ? formValues.auth.replicas : 1}
            />
            <ServiceLine
              label="Storage"
              vcpu={enabled ? formValues.storage.vcpu : 0}
              memory={enabled ? formValues.storage.memory : 0}
              replicas={enabled ? formValues.storage.replicas : 1}
            />

            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-medium text-muted-foreground">Total</span>
              <span className="font-medium text-muted-foreground tabular-nums">
                {prettifyVCPU(totalBillableVCPU)} vCPU +{' '}
                {prettifyMemory(totalBillableMemory)}
              </span>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-medium">Approximate Cost</span>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Info
                    className="h-4 w-4 text-primary"
                    aria-label="Billing info"
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                $0.0012/minute for every 1 vCPU and 2 GiB of RAM.
              </TooltipContent>
            </Tooltip>
          </div>

          <span className="text-sm">
            {enabled ? `$${updatedPrice?.toFixed(2)}/mo` : '$0/mo'}
          </span>
        </div>

        {enabled && (
          <p className="text-muted-foreground text-xs">
            Note: Your organization's $15 worth of credits cover both shared and
            dedicated compute.
          </p>
        )}
      </div>

      <div className="grid grid-flow-row gap-2">
        <Button
          type="button"
          variant={totalBillableVCPU > 0 ? 'default' : 'destructive'}
          onClick={onSubmit}
          autoFocus
        >
          Confirm
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
