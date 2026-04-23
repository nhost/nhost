import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Skeleton } from '@/components/ui/v3/skeleton';
import MetricPanelDialog from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricPanelDialog';
import useMetricsPanelUrlState from '@/features/orgs/projects/serverless-functions/components/MetricsTab/hooks/useMetricsPanelUrlState';
import ErrorsSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ErrorsSection';
import GeneralSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/GeneralSection';
import ResponseTimesSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ResponseTimesSection';
import SummarySection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/SummarySection';
import { useFunctionMetrics } from '@/features/orgs/projects/serverless-functions/hooks/useFunctionMetrics';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';

export interface MetricsTabProps {
  fn: NhostFunction;
}

export default function MetricsTab({ fn }: MetricsTabProps) {
  const { data, loading, error } = useFunctionMetrics({ route: fn.route });
  const { openPanel, filter, open, close, setFilter } =
    useMetricsPanelUrlState();

  if (loading && !data) {
    return (
      <div className="flex flex-col gap-6 p-6">
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

  if (error) {
    return (
      <div className="p-6">
        <p className="text-destructive text-sm">
          Failed to load metrics. {error.message}
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6">
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
    </div>
  );
}
