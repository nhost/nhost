import type { ReactNode } from 'react';
import { useMemo } from 'react';
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
import { useChartInteractions } from '@/features/orgs/projects/common/metrics/hooks/useChartInteractions';
import type {
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
import TooltipFooter from './TooltipFooter';
import type { StackedBarReferenceLine } from './types';
import VerticalReferenceLineLabel from './VerticalReferenceLineLabel';

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
    zoom,
    handleLegendItemClick,
    handleClick,
    handleDoubleClick,
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
            onClick={handleClick}
            // Drag and double-click only respond when their callback is set.
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
                    timestamp={referenceLine.value}
                    timeDomain={timeDomain}
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
