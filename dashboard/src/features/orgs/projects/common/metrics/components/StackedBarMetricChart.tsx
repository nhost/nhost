import type { ReactNode } from 'react';
import { useCallback, useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  type DefaultLegendContentProps,
  ReferenceArea,
  ReferenceLine,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from '@/components/ui/v3/chart';
import InteractiveChartLegend from '@/features/orgs/projects/common/metrics/components/InteractiveChartLegend';
import {
  HoverTooltipContent,
  PinnedTooltip,
  TOOLTIP_WRAPPER_STYLE,
  type TooltipEntry,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import { useDragToZoom } from '@/features/orgs/projects/common/metrics/hooks/useDragToZoom';
import { usePinnedTooltip } from '@/features/orgs/projects/common/metrics/hooks/usePinnedTooltip';
import { useSeriesVisibility } from '@/features/orgs/projects/common/metrics/hooks/useSeriesVisibility';
import type {
  ChartMouseEvent,
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { buildChart } from '@/features/orgs/projects/common/metrics/utils/buildChart';
import { buildValueTicks } from '@/features/orgs/projects/common/metrics/utils/buildValueTicks';
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
  allowDecimals?: boolean;
  legendItemAddon?: (key: string) => ReactNode;
  onZoomRange?: (from: number, to: number) => void;
  onZoomOut?: VoidFunction;
  emptyLabel?: string;
  ariaLabel?: string;
}

// Keeps the tallest bar clear of the top edge of the plot.
const Y_AXIS_HEADROOM = 1.1;

// A reference line only stretches the value axis once the data reaches this
// share of it; far below the line, stretching would flatten every bar.
const REFERENCE_LINE_AXIS_THRESHOLD = 0.5;

const PLOT_MARGIN_TOP = 8;

// Vertical reference line labels sit in this margin above the plot, where no
// bar can cover them.
const REFERENCE_LABEL_MARGIN_TOP = 24;
const REFERENCE_LABEL_GAP = 6;

interface TooltipFooterProps {
  entries: TooltipEntry[];
  totalLabel: string;
  referenceLines?: StackedBarReferenceLine[];
  format: (value: number) => string;
}

function TooltipFooter({
  entries,
  totalLabel,
  referenceLines,
  format,
}: TooltipFooterProps) {
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

export default function StackedBarMetricChart({
  data,
  accessors,
  valueFormatter,
  xTickFormatter,
  labelFormatter,
  totalLabel = 'Total',
  filteredTotalLabel,
  referenceLines,
  verticalReferenceLines,
  timeDomain,
  xTicks,
  height = 260,
  minWidth,
  maxBarSize,
  allowDecimals = true,
  legendItemAddon,
  onZoomRange,
  onZoomOut,
  emptyLabel = 'No data available.',
  ariaLabel,
}: StackedBarMetricChartProps) {
  const { keys, rows, config } = useMemo(
    () => buildChart(data, accessors),
    [data, accessors],
  );
  const { hiddenSet, handleLegendClick } = useSeriesVisibility({ keys });
  const pin = usePinnedTooltip({ rows, keys, hiddenSet, config });
  const zoom = useDragToZoom({
    onZoomRange: (from, to) => {
      pin.clearPinned();
      onZoomRange?.(from, to);
    },
  });

  const yTicks = useMemo(() => {
    const tallestBar = Math.max(
      0,
      ...rows.map((row) =>
        keys.reduce(
          (sum, key) => (hiddenSet.has(key) ? sum : sum + (row[key] ?? 0)),
          0,
        ),
      ),
    );
    const reachedReferenceValues = (referenceLines ?? [])
      .filter(
        (referenceLine) =>
          tallestBar >= referenceLine.value * REFERENCE_LINE_AXIS_THRESHOLD,
      )
      .map((referenceLine) => referenceLine.value);
    return buildValueTicks(
      Math.max(tallestBar, ...reachedReferenceValues) * Y_AXIS_HEADROOM,
      allowDecimals,
    );
  }, [allowDecimals, hiddenSet, keys, referenceLines, rows]);

  // Bars are centred on their timestamps, so the zoom selection is widened by
  // half a bar on each side to cover the bars it includes.
  const halfBarSpacing =
    timeDomain && rows.length > 1
      ? (rows[1].timestamp - rows[0].timestamp) / 2
      : 0;

  const handleClick = (event: ChartMouseEvent) => {
    if (!zoom.consumeDragClick()) {
      pin.togglePinAt(event);
    }
  };

  const handleDoubleClick = () => {
    pin.clearPinned();
    onZoomOut?.();
  };

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

  const format = (value: number) =>
    valueFormatter?.(value) ?? value.toLocaleString();
  const visibleCount = keys.filter((key) => !hiddenSet.has(key)).length;
  const footerTotalLabel =
    filteredTotalLabel && visibleCount < keys.length
      ? filteredTotalLabel(visibleCount)
      : totalLabel;
  const tooltipOptions = {
    valueFormatter,
    labelFormatter: labelFormatter ?? xTickFormatter,
    reverseEntries: true,
    renderFooter: (entries: TooltipEntry[]) => (
      <TooltipFooter
        entries={entries}
        totalLabel={footerTotalLabel}
        referenceLines={referenceLines}
        format={format}
      />
    ),
  };

  // Recharts rebuilds every bar when an axis formatter or the legend content
  // changes identity. A rebuilt bar loses the click or double-click in progress
  // on it, so the legend stays stable across re-renders.
  const renderLegend = useCallback(
    ({ payload }: DefaultLegendContentProps) =>
      payload?.length ? (
        <InteractiveChartLegend
          payload={payload}
          config={config}
          hiddenSet={hiddenSet}
          onItemClick={handleLegendItemClick}
          renderItemAddon={legendItemAddon}
        />
      ) : null,
    [config, handleLegendItemClick, hiddenSet, legendItemAddon],
  );

  if (rows.length === 0 || keys.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      </div>
    );
  }

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
            onClick={handleClick}
            onMouseDown={onZoomRange ? zoom.handleMouseDown : undefined}
            onMouseMove={onZoomRange ? zoom.handleMouseMove : undefined}
            onMouseUp={onZoomRange ? zoom.handleMouseUp : undefined}
            onDoubleClick={onZoomOut ? handleDoubleClick : undefined}
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
              type={timeDomain ? 'number' : 'category'}
              scale={timeDomain ? 'time' : 'auto'}
              domain={timeDomain}
              ticks={xTicks}
              allowDataOverflow={Boolean(timeDomain)}
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
            <ChartLegend content={renderLegend} />
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
            {zoom.selection ? (
              <ReferenceArea
                x1={zoom.selection.from - halfBarSpacing}
                x2={zoom.selection.to + halfBarSpacing}
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
