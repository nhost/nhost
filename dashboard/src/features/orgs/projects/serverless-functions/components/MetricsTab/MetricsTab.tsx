import { RefreshCw } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Button } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import MetricPanelDialog from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricPanelDialog';
import MetricsTimeRangeFilter from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricsTimeRangeFilter';
import useMetricsPanelUrlState from '@/features/orgs/projects/serverless-functions/components/MetricsTab/hooks/useMetricsPanelUrlState';
import useMetricsTimeRangeUrlState from '@/features/orgs/projects/serverless-functions/components/MetricsTab/hooks/useMetricsTimeRangeUrlState';
import ErrorsSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ErrorsSection';
import GeneralSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/GeneralSection';
import ResponseTimesSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ResponseTimesSection';
import SummarySection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/SummarySection';
import { useFunctionMetrics } from '@/features/orgs/projects/serverless-functions/hooks/useFunctionMetrics';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface MetricsTabProps {
  fn: NhostFunction;
}

function MetricsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default function MetricsTab({ fn }: MetricsTabProps) {
  const { range, setRange } = useMetricsTimeRangeUrlState();
  const { data, loading, error, refetch } = useFunctionMetrics({
    route: fn.route,
    range,
  });
  const { openPanel, filter, open, close, setFilter } =
    useMetricsPanelUrlState();

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-row items-center justify-end gap-2">
        <MetricsTimeRangeFilter value={range} onChange={setRange} />
        <Button
          variant="outline"
          size="icon"
          onClick={refetch}
          disabled={loading}
          aria-label="Refresh metrics"
          data-testid="metricsRefreshButton"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {error && (
        <p className="text-destructive text-sm">
          Failed to load metrics. {error.message}
        </p>
      )}

      {!error && loading && !data && <MetricsLoadingSkeleton />}

      {!error && data && (
        <>
          <Accordion
            type="multiple"
            defaultValue={['summary', 'general', 'responseTimes', 'errors']}
          >
            <AccordionItem value="summary">
              <AccordionTrigger>Summary</AccordionTrigger>
              <AccordionContent>
                <SummarySection summary={data.summary} />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="general">
              <AccordionTrigger>General</AccordionTrigger>
              <AccordionContent>
                <GeneralSection
                  invocationsByMethod={data.general.invocationsByMethod}
                  responseStatus={data.general.responseStatus}
                  averageResponseSize={data.general.averageResponseSize}
                  totalRequests={data.general.totalRequests}
                  onExpand={open}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="responseTimes">
              <AccordionTrigger>Response Times</AccordionTrigger>
              <AccordionContent>
                <ResponseTimesSection
                  max={data.responseTimes.max}
                  p95={data.responseTimes.p95}
                  p75={data.responseTimes.p75}
                  avg={data.responseTimes.avg}
                  onExpand={open}
                />
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="errors">
              <AccordionTrigger>Errors</AccordionTrigger>
              <AccordionContent>
                <ErrorsSection
                  errorRate={data.errors.errorRate}
                  totalErrors={data.errors.totalErrors}
                  onExpand={open}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          <MetricPanelDialog
            openPanel={openPanel}
            filter={filter}
            metrics={data}
            onClose={close}
            onFilterChange={setFilter}
          />
        </>
      )}
    </div>
  );
}
