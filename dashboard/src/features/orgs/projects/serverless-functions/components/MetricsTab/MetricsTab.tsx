import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeBlock } from '@/components/presentational/CodeBlock';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/v3/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Skeleton } from '@/components/ui/v3/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import MetricPanelDialog from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricPanelDialog';
import MetricsTimeRangeFilter from '@/features/orgs/projects/serverless-functions/components/MetricsTab/components/MetricsTimeRangeFilter';
import useMetricsPanelUrlState from '@/features/orgs/projects/serverless-functions/components/MetricsTab/hooks/useMetricsPanelUrlState';
import useMetricsTimeRangeUrlState from '@/features/orgs/projects/serverless-functions/components/MetricsTab/hooks/useMetricsTimeRangeUrlState';
import ErrorsSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ErrorsSection';
import GeneralSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/GeneralSection';
import ResponseTimesSection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/ResponseTimesSection';
import SummarySection from '@/features/orgs/projects/serverless-functions/components/MetricsTab/sections/SummarySection';
import { resolveTimeRange } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/timeRange';
import { useFunctionMetrics } from '@/features/orgs/projects/serverless-functions/hooks/useFunctionMetrics';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface MetricsTabProps {
  fn: NhostFunction;
}

const MAX_SPAN_MS = 90 * 24 * 60 * 60_000;

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
  const { openPanel, hiddenKeys, open, close, setHiddenKeys } =
    useMetricsPanelUrlState();

  const chartCellRef = useRef<HTMLDivElement | null>(null);
  const [chartWidth, setChartWidth] = useState(0);

  useEffect(() => {
    const el = chartCellRef.current;
    if (!el) {
      return undefined;
    }
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width ?? 0;
      setChartWidth(Math.round(next));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { data, loading, error, refetch, xDomain } = useFunctionMetrics({
    route: fn.route,
    range,
    chartWidth,
  });

  const handleZoomRange = useCallback(
    (fromMs: number, toMs: number) => {
      setRange({
        kind: 'absolute',
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
      });
    },
    [setRange],
  );

  const handleZoomOut = useCallback(() => {
    const { from, to } = resolveTimeRange(range);
    const fromMs = from.getTime();
    const toMs = to.getTime();
    const span = toMs - fromMs;
    if (span <= 0) {
      return;
    }
    const newSpan = Math.min(span * 2, MAX_SPAN_MS);
    if (newSpan === span) {
      return;
    }
    const midMs = (fromMs + toMs) / 2;
    const halfNewSpan = newSpan / 2;
    setRange({
      kind: 'absolute',
      from: new Date(midMs - halfNewSpan).toISOString(),
      to: new Date(midMs + halfNewSpan).toISOString(),
    });
  }, [range, setRange]);

  return (
    <div className="relative flex flex-col">
      <div
        aria-hidden
        className="pointer-events-none invisible absolute inset-x-6 top-6 grid grid-cols-1 gap-4 xl:grid-cols-2"
      >
        <div ref={chartCellRef} className="h-0" />
      </div>
      <div className="sticky top-0 z-10 flex flex-row items-center justify-end gap-2 border-b bg-background px-6 py-4">
        <MetricsTimeRangeFilter value={range} onChange={setRange} />
        <Tooltip>
          <TooltipTrigger asChild>
            <ButtonWithLoading
              variant="outline"
              size="icon"
              onClick={refetch}
              loading={loading}
              loaderClassName="mr-0 h-4 w-4"
              aria-label="Refresh metrics"
              data-testid="metricsRefreshButton"
            >
              {!loading && <RefreshCw className="h-4 w-4" />}
            </ButtonWithLoading>
          </TooltipTrigger>
          <TooltipContent>Refresh metrics</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex flex-col gap-6 p-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Couldn't load metrics</AlertTitle>
            <AlertDescription className="mt-2 flex flex-col gap-3">
              <span>
                Please try again in a few minutes. This is usually temporary.
              </span>
              <div className="rounded bg-[#f4f7f9] py-2 dark:bg-[#21262d]">
                <CodeBlock
                  copyToClipboardToastTitle="Error details"
                  className="!mt-0 text-sm"
                >
                  {error.message}
                </CodeBlock>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={refetch}
                disabled={loading}
                className="self-start text-foreground"
              >
                <RefreshCw
                  className={cn('mr-2 h-3.5 w-3.5', loading && 'animate-spin')}
                />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
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
                    xDomain={xDomain}
                    onExpand={open}
                    onZoomRange={handleZoomRange}
                    onZoomOut={handleZoomOut}
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
                    xDomain={xDomain}
                    onExpand={open}
                    onZoomRange={handleZoomRange}
                    onZoomOut={handleZoomOut}
                  />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="errors">
                <AccordionTrigger>Errors</AccordionTrigger>
                <AccordionContent>
                  <ErrorsSection
                    errorRate={data.errors.errorRate}
                    totalErrors={data.errors.totalErrors}
                    xDomain={xDomain}
                    onExpand={open}
                    onZoomRange={handleZoomRange}
                    onZoomOut={handleZoomOut}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <MetricPanelDialog
              openPanel={openPanel}
              hiddenKeys={hiddenKeys}
              metrics={data}
              xDomain={xDomain}
              onClose={close}
              onHiddenKeysChange={setHiddenKeys}
              onZoomRange={handleZoomRange}
              onZoomOut={handleZoomOut}
            />
          </>
        )}
      </div>
    </div>
  );
}
