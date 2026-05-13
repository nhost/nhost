import { useWatch } from 'react-hook-form';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { prettifyMemory } from '@/features/orgs/projects/resources/settings/utils/prettifyMemory';
import { prettifyVCPU } from '@/features/orgs/projects/resources/settings/utils/prettifyVCPU';
import type { ResourceSettingsFormValues } from '@/features/orgs/projects/resources/settings/utils/resourceSettingsValidationSchema';
import { cn } from '@/lib/utils';
import {
  RESOURCE_MEMORY_MULTIPLIER,
  RESOURCE_VCPU_MEMORY_RATIO,
  RESOURCE_VCPU_MULTIPLIER,
} from '@/utils/constants/common';

type ServiceKey = 'database' | 'hasura' | 'auth' | 'storage';

interface ServiceMeta {
  key: ServiceKey;
  label: string;
  fill: string;
  legend: string;
}

const SERVICES: ServiceMeta[] = [
  {
    key: 'database',
    label: 'PostgreSQL',
    fill: 'bg-blue-500',
    legend: 'bg-blue-500',
  },
  {
    key: 'hasura',
    label: 'Hasura',
    fill: 'bg-violet-500',
    legend: 'bg-violet-500',
  },
  {
    key: 'auth',
    label: 'Auth',
    fill: 'bg-emerald-500',
    legend: 'bg-emerald-500',
  },
  {
    key: 'storage',
    label: 'Storage',
    fill: 'bg-amber-500',
    legend: 'bg-amber-500',
  },
];

interface SegmentInput {
  key: ServiceKey;
  label: string;
  value: number;
  formatted: string;
  fill: string;
}

function StackedBar({
  segments,
  scale,
  trailing,
  overlay,
}: {
  segments: SegmentInput[];
  scale: number;
  trailing?: { widthPct: number; label: string } | null;
  overlay?: { widthPct: number; label: string } | null;
}) {
  return (
    <div className="relative flex h-3 w-full overflow-hidden rounded-full bg-muted/50">
      {segments.map((segment) => {
        const widthPct = scale > 0 ? (segment.value / scale) * 100 : 0;
        if (widthPct <= 0) {
          return null;
        }
        return (
          <Tooltip key={segment.key}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`${segment.label}: ${segment.formatted}`}
                className={cn('h-full transition-all', segment.fill)}
                style={{ width: `${widthPct}%` }}
              />
            </TooltipTrigger>
            <TooltipContent>
              <span className="font-medium">{segment.label}</span>{' '}
              <span className="text-muted-foreground">{segment.formatted}</span>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {trailing && trailing.widthPct > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={trailing.label}
              className="h-full border-2 border-destructive border-dashed bg-destructive/10 transition-all"
              style={{ width: `${trailing.widthPct}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>{trailing.label}</TooltipContent>
        </Tooltip>
      )}
      {overlay && overlay.widthPct > 0 && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={overlay.label}
              className="absolute top-0 right-0 h-full border-2 border-destructive border-dashed transition-all"
              style={{ width: `${overlay.widthPct}%` }}
            />
          </TooltipTrigger>
          <TooltipContent>{overlay.label}</TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

export default function ResourceBreakdownChart() {
  const [database, hasura, auth, storage] = useWatch<
    ResourceSettingsFormValues,
    ['database', 'hasura', 'auth', 'storage']
  >({ name: ['database', 'hasura', 'auth', 'storage'] });

  const serviceMap = { database, hasura, auth, storage } as const;

  const totalCPU = SERVICES.reduce((sum, { key }) => {
    const service = serviceMap[key];
    const cpu = service?.vcpu ?? 0;
    const replicas =
      key === 'database'
        ? 1
        : ((service as { replicas?: number } | undefined)?.replicas ?? 1);
    return sum + cpu * replicas;
  }, 0);

  const totalMemory = SERVICES.reduce((sum, { key }) => {
    const service = serviceMap[key];
    const memory = service?.memory ?? 0;
    const replicas =
      key === 'database'
        ? 1
        : ((service as { replicas?: number } | undefined)?.replicas ?? 1);
    return sum + memory * replicas;
  }, 0);

  const expectedMemory =
    (totalCPU / RESOURCE_VCPU_MULTIPLIER) *
    RESOURCE_VCPU_MEMORY_RATIO *
    RESOURCE_MEMORY_MULTIPLIER;
  const memoryDelta = expectedMemory - totalMemory;
  const memoryScale = Math.max(totalMemory, expectedMemory);

  const cpuSegments: SegmentInput[] = SERVICES.map(({ key, label, fill }) => {
    const service = serviceMap[key];
    const cpu = service?.vcpu ?? 0;
    const replicas =
      key === 'database'
        ? 1
        : ((service as { replicas?: number } | undefined)?.replicas ?? 1);
    const value = cpu * replicas;
    return {
      key,
      label,
      value,
      formatted: `${prettifyVCPU(value).toFixed(2)} vCPU${replicas > 1 ? ` (${replicas}×)` : ''}`,
      fill,
    };
  });

  const memorySegments: SegmentInput[] = SERVICES.map(
    ({ key, label, fill }) => {
      const service = serviceMap[key];
      const memory = service?.memory ?? 0;
      const replicas =
        key === 'database'
          ? 1
          : ((service as { replicas?: number } | undefined)?.replicas ?? 1);
      const value = memory * replicas;
      return {
        key,
        label,
        value,
        formatted: `${prettifyMemory(value)}${replicas > 1 ? ` (${replicas}×)` : ''}`,
        fill,
      };
    },
  );

  const memoryTrailing =
    memoryDelta > 0
      ? {
          widthPct: memoryScale > 0 ? (memoryDelta / memoryScale) * 100 : 0,
          label: `${prettifyMemory(memoryDelta)} unallocated — total memory must equal 2× total vCPU`,
        }
      : null;

  const memoryOverlay =
    memoryDelta < 0
      ? {
          widthPct: memoryScale > 0 ? (-memoryDelta / memoryScale) * 100 : 0,
          label: `${prettifyMemory(-memoryDelta)} over the 1:2 ratio — reduce memory or allocate more vCPU`,
        }
      : null;

  return (
    <div className="flex flex-col gap-4 rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm">CPU</span>
          <span className="font-medium tabular-nums">
            {prettifyVCPU(totalCPU).toFixed(2)} vCPU
          </span>
        </div>
        <StackedBar segments={cpuSegments} scale={totalCPU} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-medium text-sm">Memory</span>
          <span className="font-medium tabular-nums">
            {prettifyMemory(totalMemory)}
            {memoryDelta !== 0 && (
              <span className="ml-1 text-muted-foreground text-xs">
                / {prettifyMemory(expectedMemory)} expected
              </span>
            )}
          </span>
        </div>
        <StackedBar
          segments={memorySegments}
          scale={memoryScale}
          trailing={memoryTrailing}
          overlay={memoryOverlay}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1 text-xs">
        {SERVICES.map(({ key, label, legend }) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', legend)} />
            <span className="text-muted-foreground">{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
