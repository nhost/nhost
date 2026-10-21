import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from '@/components/ui/v3/chart';
import { InteractiveChartLegend } from '@/features/orgs/projects/common/metrics/components/InteractiveChartLegend';
import {
  HoverTooltipContent,
  PinnedTooltip,
  type TooltipEntry,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import { TOOLTIP_WRAPPER_STYLE } from '@/features/orgs/projects/common/metrics/constants';
import { useDragToZoom } from '@/features/orgs/projects/common/metrics/hooks/useDragToZoom';
import { usePinnedTooltip } from '@/features/orgs/projects/common/metrics/hooks/usePinnedTooltip';
import { useSeriesVisibility } from '@/features/orgs/projects/common/metrics/hooks/useSeriesVisibility';
import type {
  ChartMouseEvent,
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import {
  buildChart,
  type ChartModel,
} from '@/features/orgs/projects/common/metrics/utils/buildChart';
import { buildStackedValueTicks } from '@/features/orgs/projects/common/metrics/utils/buildStackedValueTicks';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';
import { cn } from '@/lib/utils';

interface StackedBarReferenceLine {
  value: number;
  label: string;
}

export interface StackedBarMetricChartProps {
  data: MetricSeries[];
  accessors: SeriesAccessors;
  valueFormatter?: (value: number) => string;
  xTickFormatter?: (timestamp: number) => string;
  labelFormatter?: (timestamp: number) => string;
  totalLabel?: string;
  // Replaces `totalLabel` while some series are hidden in the legend.
  filteredTotalLabel?: (visibleCount: number) => string;
  referenceLines?: StackedBarReferenceLine[];
  verticalReferenceLines?: StackedBarReferenceLine[];
  timeDomain?: [number, number];
  xTicks?: number[];
  height?: number;
  minWidth?: number;
  maxBarSize?: number;
  legendItemAddon?: (key: string) => ReactNode;
  onZoomRange?: (from: number, to: number) => void;
  onZoomOut?: VoidFunction;
  emptyLabel?: string;
  ariaLabel?: string;
}

const PLOT_MARGIN_TOP = 8;

// More project rows than this push the tooltip's total and reference lines
// past the bottom of the default 260px chart, where they are cut off.
const MAX_TOOLTIP_ENTRIES = 7;

// Vertical reference line labels sit in this margin above the plot, where no
// bar can cover them.
const REFERENCE_LABEL_MARGIN_TOP = 24;
const REFERENCE_LABEL_GAP = 6;

interface TooltipFooterProps {
  entries: TooltipEntry[];
  totalLabel: string;
  referenceLines?: StackedBarReferenceLine[];
  valueFormatter?: (value: number) => string;
}

function TooltipFooter({
  entries,
  totalLabel,
  referenceLines,
  valueFormatter,
}: TooltipFooterProps) {
  const format = (value: number) =>
    valueFormatter?.(value) ?? value.toLocaleString();
  const total = entries.reduce(
    (sum, entry) => sum + (typeof entry.value === 'number' ? entry.value : 0),
    0,
  );
  return (
    <>
      {referenceLines?.map((referenceLine) => (
        <div
          key={referenceLine.label}
          className="flex items-center justify-between gap-4 border-border/50 border-t pt-1.5 leading-none"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="w-3 border-primary border-t border-dashed" />
            {referenceLine.label}
          </span>
          <span className="font-medium font-mono tabular-nums">
            {format(referenceLine.value)}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between gap-4 border-border/50 border-t pt-1.5 leading-none">
        <span className="font-medium">{totalLabel}</span>
        <span className="font-medium font-mono tabular-nums">
          {format(total)}
        </span>
      </div>
    </>
  );
}

function verticalReferenceLabelAnchor(
  value: number,
  timeDomain: [number, number] | undefined,
): 'start' | 'end' {
  if (!timeDomain) {
    return 'end';
  }
  const midpoint = timeDomain[0] + (timeDomain[1] - timeDomain[0]) / 2;
  return value <= midpoint ? 'start' : 'end';
}

interface VerticalReferenceLineLabelProps {
  value: string;
  textAnchor: 'start' | 'end';
  viewBox?: { x?: number; y?: number };
}

// Recharts' built-in `top` position gives vertical-line labels a zero width,
// which wraps every word onto its own line, so the label is drawn directly.
function VerticalReferenceLineLabel({
  value,
  textAnchor,
  viewBox,
}: VerticalReferenceLineLabelProps) {
  if (viewBox?.x == null || viewBox.y == null) {
    return null;
  }
  return (
    <text
      x={viewBox.x}
      y={viewBox.y - REFERENCE_LABEL_GAP}
      textAnchor={textAnchor}
      fill="hsl(var(--muted-foreground))"
      fontSize={12}
    >
      {value}
    </text>
  );
}

// Bars are centred on their timestamps, so the zoom selection is widened by
// half a bar on each side to cover the bars it includes.
function getHalfBarSpacing(
  rows: Row[],
  timeDomain: [number, number] | undefined,
) {
  if (!timeDomain || rows.length < 2) {
    return 0;
  }
  return (rows[1].timestamp - rows[0].timestamp) / 2;
}

// With a time domain, bars sit at their timestamps on a continuous time axis.
// Without one, each row gets an evenly spaced slot.
function getXAxisScaleProps(timeDomain: [number, number] | undefined) {
  if (!timeDomain) {
    return {
      type: 'category',
      scale: 'auto',
      domain: undefined,
      allowDataOverflow: false,
    } as const;
  }
  return {
    type: 'number',
    scale: 'time',
    domain: timeDomain,
    allowDataOverflow: true,
  } as const;
}

interface FooterTotalLabelOptions {
  totalLabel: string;
  filteredTotalLabel?: (visibleCount: number) => string;
  keys: string[];
  hiddenSet: Set<string>;
}

function getFooterTotalLabel({
  totalLabel,
  filteredTotalLabel,
  keys,
  hiddenSet,
}: FooterTotalLabelOptions) {
  const visibleCount = keys.filter((key) => !hiddenSet.has(key)).length;
  if (filteredTotalLabel && visibleCount < keys.length) {
    return filteredTotalLabel(visibleCount);
  }
  return totalLabel;
}

interface UseChartInteractionsOptions {
  rows: Row[];
  keys: string[];
  config: ChartConfig;
  onZoomRange?: (from: number, to: number) => void;
  onZoomOut?: VoidFunction;
}

// Legend filtering, click to pin a tooltip, drag to zoom and double-click to
// zoom out. Drag and double-click only respond when their callback is set.
function useChartInteractions({
  rows,
  keys,
  config,
  onZoomRange,
  onZoomOut,
}: UseChartInteractionsOptions) {
  const { hiddenSet, handleLegendClick } = useSeriesVisibility({ keys });
  const pin = usePinnedTooltip({ rows, keys, hiddenSet, config });
  const zoom = useDragToZoom({
    onZoomRange: (from, to) => {
      pin.clearPinned();
      onZoomRange?.(from, to);
    },
  });

  // A pinned tooltip is a snapshot of the series visible when it was pinned,
  // so it is closed rather than left out of sync with the legend.
  const { clearPinned } = pin;
  const handleLegendItemClick = useCallback<typeof handleLegendClick>(
    (key, modifiers) => {
      clearPinned();
      handleLegendClick(key, modifiers);
    },
    [clearPinned, handleLegendClick],
  );

  const handleClick = (event: ChartMouseEvent) => {
    if (!zoom.consumeDragClick()) {
      pin.togglePinAt(event);
    }
  };

  const handleDoubleClick = () => {
    pin.clearPinned();
    onZoomOut?.();
  };

  const chartHandlers = {
    onClick: handleClick,
    onMouseDown: onZoomRange ? zoom.handleMouseDown : undefined,
    onMouseMove: onZoomRange ? zoom.handleMouseMove : undefined,
    onMouseUp: onZoomRange ? zoom.handleMouseUp : undefined,
    onDoubleClick: onZoomOut ? handleDoubleClick : undefined,
  };

  return {
    hiddenSet,
    pin,
    zoomSelection: zoom.selection,
    chartHandlers,
    handleLegendItemClick,
  };
}

export default function StackedBarMetricChart({
  data,
  accessors,
  height = 260,
  emptyLabel = 'No data available.',
  ...chartProps
}: StackedBarMetricChartProps) {
  const chart = useMemo(() => buildChart(data, accessors), [data, accessors]);

  if (chart.rows.length === 0 || chart.keys.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return <StackedBarChart chart={chart} height={height} {...chartProps} />;
}

interface StackedBarChartProps
  extends Omit<
    StackedBarMetricChartProps,
    'data' | 'accessors' | 'emptyLabel'
  > {
  chart: ChartModel;
  height: number;
}

function StackedBarChart({
  chart: { keys, rows, config },
  valueFormatter,
  xTickFormatter,
  labelFormatter,
  totalLabel = 'Total',
  filteredTotalLabel,
  referenceLines,
  verticalReferenceLines,
  timeDomain,
  xTicks,
  height,
  minWidth,
  maxBarSize,
  legendItemAddon,
  onZoomRange,
  onZoomOut,
  ariaLabel,
}: StackedBarChartProps) {
  const {
    hiddenSet,
    pin,
    zoomSelection,
    chartHandlers,
    handleLegendItemClick,
  } = useChartInteractions({ rows, keys, config, onZoomRange, onZoomOut });

  const yTicks = useMemo(
    () =>
      buildStackedValueTicks({
        rows,
        keys,
        hiddenSet,
        referenceLines,
      }),
    [hiddenSet, keys, referenceLines, rows],
  );
  const halfBarSpacing = getHalfBarSpacing(rows, timeDomain);

  const footerTotalLabel = getFooterTotalLabel({
    totalLabel,
    filteredTotalLabel,
    keys,
    hiddenSet,
  });
  const tooltipOptions = {
    valueFormatter,
    labelFormatter: labelFormatter ?? xTickFormatter,
    matchStackOrder: true,
    maxEntries: MAX_TOOLTIP_ENTRIES,
    renderFooter: (entries: TooltipEntry[]) => (
      <TooltipFooter
        entries={entries}
        totalLabel={footerTotalLabel}
        referenceLines={referenceLines}
        valueFormatter={valueFormatter}
      />
    ),
  };

  // Recharts rebuilds every bar when the legend content changes identity, and
  // a rebuilt bar loses the click or double-click in progress on it, so the
  // legend is memoized. It is an element, not a function: Recharts treats a
  // function as a component type and would remount the legend on every
  // toggle, dropping keyboard focus. `itemSorter={null}` keeps the legend in
  // series order; Recharts sorts it by series key otherwise.
  const legendContent = useMemo(
    () => (
      <InteractiveChartLegend
        config={config}
        hiddenSet={hiddenSet}
        onItemClick={handleLegendItemClick}
        renderItemAddon={legendItemAddon}
      />
    ),
    [config, handleLegendItemClick, hiddenSet, legendItemAddon],
  );

  return (
    <figure aria-label={ariaLabel} className="group w-full overflow-x-auto">
      <div ref={pin.wrapperRef} className="relative" style={{ minWidth }}>
        <ChartContainer
          config={config}
          className={cn(
            'aspect-auto w-full overflow-hidden',
            onZoomRange && 'select-none',
          )}
          style={{ height, minWidth }}
        >
          <BarChart
            data={rows}
            margin={{
              top: verticalReferenceLines?.length
                ? REFERENCE_LABEL_MARGIN_TOP
                : PLOT_MARGIN_TOP,
              right: 12,
              left: 12,
            }}
            {...chartHandlers}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            {referenceLines?.map((referenceLine) => (
              <ReferenceLine
                key={referenceLine.label}
                y={referenceLine.value}
                className="opacity-0 transition-opacity group-hover:opacity-80"
                stroke="hsl(var(--primary))"
                strokeDasharray="6 4"
              />
            ))}
            {verticalReferenceLines?.map((referenceLine) => (
              <ReferenceLine
                key={`${referenceLine.label}-${referenceLine.value}`}
                x={referenceLine.value}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="3 3"
                strokeOpacity={0.7}
                label={
                  <VerticalReferenceLineLabel
                    value={referenceLine.label}
                    textAnchor={verticalReferenceLabelAnchor(
                      referenceLine.value,
                      timeDomain,
                    )}
                  />
                }
              />
            ))}
            <XAxis
              dataKey="timestamp"
              {...getXAxisScaleProps(timeDomain)}
              ticks={xTicks}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              interval={xTicks ? 0 : undefined}
              tickFormatter={xTickFormatter}
            />
            <YAxis
              domain={[0, yTicks[yTicks.length - 1]]}
              ticks={yTicks}
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={valueFormatter}
            />
            <ChartTooltip
              cursor={!pin.pinned}
              active={pin.pinned ? false : undefined}
              wrapperStyle={TOOLTIP_WRAPPER_STYLE}
              content={
                <HoverTooltipContent config={config} {...tooltipOptions} />
              }
            />
            <ChartLegend content={legendContent} itemSorter={null} />
            {keys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stack"
                fill={`var(--color-${key})`}
                hide={hiddenSet.has(key)}
                isAnimationActive={false}
                maxBarSize={maxBarSize}
              />
            ))}
            {zoomSelection ? (
              <ReferenceArea
                x1={zoomSelection.from - halfBarSpacing}
                x2={zoomSelection.to + halfBarSpacing}
                strokeOpacity={0.3}
                fillOpacity={0.1}
              />
            ) : null}
          </BarChart>
        </ChartContainer>

        {pin.pinned ? (
          <PinnedTooltip
            pinned={pin.pinned}
            config={config}
            {...tooltipOptions}
            onClose={pin.clearPinned}
          />
        ) : null}
      </div>
    </figure>
  );
}
