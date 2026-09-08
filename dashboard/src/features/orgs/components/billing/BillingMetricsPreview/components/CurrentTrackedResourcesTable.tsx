import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import BillingSectionCard from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingSectionCard';
import type {
  BillingMetricsData,
  BillingTrackedResource,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';
import MetricTable from '@/features/orgs/projects/common/metrics/components/MetricTable';
import { formatInteger } from '@/features/orgs/projects/common/metrics/utils/formatters';

export interface CurrentTrackedResourcesTableProps {
  data: BillingMetricsData;
}

const PRO_TEAM_RESOURCE_PRICING = {
  compute:
    'Includes $15 in compute credits. Shared compute costs $15 per vCPU per month ($0.00034 per vCPU-minute); dedicated compute costs $50 per vCPU per month ($0.0012 per vCPU-minute). Each vCPU includes 2 GB of memory.',
  functions: '50 functions included, then $5 per additional 50 functions.',
  customDomains: '$10 per project per month.',
  persistentVolume:
    '10 GB included, then $0.20 per additional GB. Includes persistent storage used by Database and Nhost Run services.',
  pitr: 'Starts at $100 per project with 7 days of retention.',
} as const;

function enabledLabel(value: number): string {
  return value > 0 ? 'Enabled' : 'Not enabled';
}

interface PricingColumnLabelProps {
  label: string;
  pricing: string;
}

function PricingColumnLabel({ label, pricing }: PricingColumnLabelProps) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`${label} pricing for Pro and Team plans`}
          >
            <Info aria-hidden className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          Pro/Team pricing: {pricing}
        </TooltipContent>
      </Tooltip>
    </span>
  );
}

export default function CurrentTrackedResourcesTable({
  data,
}: CurrentTrackedResourcesTableProps) {
  return (
    <BillingSectionCard
      title="Current tracked resources"
      description="Current billable resources by project."
    >
      <MetricTable<BillingTrackedResource>
        rows={data.trackedResources}
        rowKey={(resource) => resource.projectID}
        emptyLabel="No tracked resources are available because this organization has no projects."
        columns={[
          {
            key: 'project',
            label: 'Project',
            render: (resource) => resource.projectName,
          },
          {
            key: 'compute',
            label: (
              <PricingColumnLabel
                label="Compute"
                pricing={PRO_TEAM_RESOURCE_PRICING.compute}
              />
            ),
            alignRight: true,
            render: (resource) =>
              `${formatInteger(resource.dedicatedComputeMillicores)} millicores`,
          },
          {
            key: 'functions',
            label: (
              <PricingColumnLabel
                label="Deployed functions"
                pricing={PRO_TEAM_RESOURCE_PRICING.functions}
              />
            ),
            alignRight: true,
            render: (resource) => formatInteger(resource.functionsAmount),
          },
          {
            key: 'domains',
            label: (
              <PricingColumnLabel
                label="Custom domains"
                pricing={PRO_TEAM_RESOURCE_PRICING.customDomains}
              />
            ),
            render: (resource) => enabledLabel(resource.customDomains),
          },
          {
            key: 'volume',
            label: (
              <PricingColumnLabel
                label="Persistent volume"
                pricing={PRO_TEAM_RESOURCE_PRICING.persistentVolume}
              />
            ),
            alignRight: true,
            render: (resource) =>
              `${formatInteger(resource.persistentVolumeGB)} GB`,
          },
          {
            key: 'pitr',
            label: (
              <PricingColumnLabel
                label="PITR"
                pricing={PRO_TEAM_RESOURCE_PRICING.pitr}
              />
            ),
            render: (resource) => enabledLabel(resource.pitr),
          },
        ]}
      />
    </BillingSectionCard>
  );
}
