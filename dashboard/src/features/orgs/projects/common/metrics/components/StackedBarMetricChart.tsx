import type { CSSProperties } from 'react';
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  type DefaultLegendContentProps,
  Rectangle,
  type RectangleProps,
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
import InteractiveChartLegend from '@/features/orgs/projects/common/metrics/components/InteractiveChartLegend';
import { resolveTooltipPosition } from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { buildChart } from '@/features/orgs/projects/common/metrics/utils/buildChart';
import type { Row } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';
import { cn } from '@/lib/utils';

interface StackedBarReferenceLine {
  value: number;
  label: string;
}

interface StackedBarVerticalReferenceLine {
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
  totalValueForTimestamp?: (timestamp: number) => number | undefined;
  referenceLines?: StackedBarReferenceLine[];
  verticalReferenceLines?: StackedBarVerticalReferenceLine[];
  timeDomain?: [number, number];
  xTicks?: number[];
  hatchedTimestamps?: number[];
  height?: number;
  minWidth?: number;
  maxBarSize?: number;
  xTickInterval?: number;
  showLegend?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
}

interface TooltipPayloadEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number;
  color?: string;
  type?: string;
  payload?: { fill?: string };
}

interface ChartMouseEvent {
  activeLabel?: string | number;
  activeTooltipIndex?: number | string | null;
  activeCoordinate?: { x?: number; y?: number };
  chartX?: number;
  chartY?: number;
}

interface PinnedStackedBarTooltipState {
  x: number;
  y: number;
  label: number;
  payload: TooltipPayloadEntry[];
}

interface StackedBarTooltipProps {
  config: ChartConfig;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (timestamp: number) => string;
  totalLabel: string;
  totalValueForTimestamp?: (timestamp: number) => number | undefined;
  referenceLines?: StackedBarReferenceLine[];
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: number | string;
  interactive?: boolean;
  onClose?: VoidFunction;
  style?: CSSProperties;
}

function StackedBarTooltip({
  config,
  valueFormatter,
  labelFormatter,
  totalLabel,
  totalValueForTimestamp,
  referenceLines,
  active,
  payload,
  label,
  interactive = false,
  onClose,
  style,
}: StackedBarTooltipProps) {
  if (!active || !payload?.length) {
    return null;
  }

  const entries = payload.filter(
    (entry) => entry.type !== 'none' && typeof entry.value === 'number',
  );
  if (entries.length === 0) {
    return null;
  }

  const visibleTotal = entries.reduce(
    (sum, entry) => sum + (entry.value ?? 0),
    0,
  );
  const total =
    typeof label === 'number'
      ? (totalValueForTimestamp?.(label) ?? visibleTotal)
      : visibleTotal;
  const format = (value: number) =>
    valueFormatter?.(value) ?? value.toLocaleString();
  const heading =
    labelFormatter && typeof label === 'number' ? labelFormatter(label) : label;

  return (
    <div
      className={cn(
        'grid min-w-[10rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-foreground text-xs shadow-xl',
        interactive && 'pointer-events-auto absolute z-10 select-text',
      )}
      style={style}
      data-testid={interactive ? 'pinned-stacked-bar-tooltip' : undefined}
      {...(interactive
        ? { role: 'dialog', 'aria-label': 'Pinned data point' }
        : {})}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{heading}</div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label="Close pinned tooltip"
          >
            ×
          </button>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        {[...entries].reverse().map((entry) => {
          const key = String(entry.dataKey ?? entry.name ?? 'value');
          return (
            <div key={key} className="flex w-full items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor:
                    entry.color ??
                    entry.payload?.fill ??
                    'hsl(var(--muted-foreground))',
                }}
              />
              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                <span className="text-muted-foreground">
                  {config[key]?.label ?? key}
                </span>
                <span className="font-medium font-mono text-foreground tabular-nums">
                  {format(entry.value ?? 0)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
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
    </div>
  );
}

interface BarShapeProps extends RectangleProps {
  payload?: Row;
}

function verticalReferenceLabelPosition(
  value: number,
  timeDomain: [number, number] | undefined,
): 'insideTopLeft' | 'insideTopRight' {
  if (!timeDomain) {
    return 'insideTopRight';
  }
  const midpoint = timeDomain[0] + (timeDomain[1] - timeDomain[0]) / 2;
  return value <= midpoint ? 'insideTopLeft' : 'insideTopRight';
}

function HatchPatternDefs({
  keys,
  idFor,
}: {
  keys: string[];
  idFor: (key: string) => string;
}) {
  return (
    <defs>
      {keys.map((key) => (
        <pattern
          key={key}
          id={idFor(key)}
          width={6}
          height={6}
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width={6} height={6} fill={`var(--color-${key})`} />
          <rect width={3} height={6} fill="hsl(var(--card))" opacity={0.55} />
        </pattern>
      ))}
    </defs>
  );
}

export default function StackedBarMetricChart({
  data,
  accessors,
  valueFormatter,
  xTickFormatter,
  labelFormatter,
  totalLabel = 'Total',
  totalValueForTimestamp,
  referenceLines,
  verticalReferenceLines,
  timeDomain,
  xTicks,
  hatchedTimestamps,
  height = 260,
  minWidth,
  maxBarSize,
  xTickInterval,
  showLegend = true,
  emptyLabel = 'No data available.',
  ariaLabel,
}: StackedBarMetricChartProps) {
  const { keys, rows, config } = useMemo(
    () => buildChart(data, accessors),
    [data, accessors],
  );
  const [hidden, setHidden] = useState<string[]>([]);
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);
  const hatched = useMemo(
    () => new Set(hatchedTimestamps ?? []),
    [hatchedTimestamps],
  );
  const instanceId = useId().replace(/:/g, '');
  const patternIdFor = (key: string) => `hatch-${instanceId}-${key}`;
  const [pinned, setPinned] = useState<PinnedStackedBarTooltipState | null>(
    null,
  );
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pinned]);

  const handleLegendClick = useCallback(
    (
      key: string,
      opts: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
    ) => {
      if (opts.metaKey || opts.ctrlKey || opts.shiftKey) {
        const next = hiddenSet.has(key)
          ? hidden.filter((hiddenKey) => hiddenKey !== key)
          : [...hidden, key];
        const nextSet = new Set(next);
        setHidden(
          keys.every((seriesKey) => nextSet.has(seriesKey)) ? [] : next,
        );
        return;
      }
      const visible = keys.filter((seriesKey) => !hiddenSet.has(seriesKey));
      setHidden(
        visible.length === 1 && visible[0] === key
          ? []
          : keys.filter((seriesKey) => seriesKey !== key),
      );
    },
    [hidden, hiddenSet, keys],
  );

  const handleClick = (event: ChartMouseEvent) => {
    const label = Number(event?.activeLabel);
    const row = rows.find((candidate) => candidate.timestamp === label);
    if (event?.activeTooltipIndex == null || !row) {
      setPinned(null);
      return;
    }

    const { x, y } = resolveTooltipPosition(chartWrapperRef.current, event);
    if (x == null || y == null) {
      setPinned(null);
      return;
    }

    const payload: TooltipPayloadEntry[] = [];
    keys.forEach((key) => {
      if (hiddenSet.has(key)) {
        return;
      }
      const value = row[key];
      if (typeof value === 'number') {
        payload.push({
          dataKey: key,
          name: key,
          value,
          color: config[key]?.color,
        });
      }
    });
    if (payload.length === 0) {
      setPinned(null);
      return;
    }

    setPinned((current) => (current ? null : { x, y, label, payload }));
  };

  const renderLegend = ({ payload }: DefaultLegendContentProps) =>
    payload?.length ? (
      <InteractiveChartLegend
        payload={payload}
        config={config}
        hiddenSet={hiddenSet}
        onItemClick={handleLegendClick}
      />
    ) : null;

  if (rows.length === 0 || keys.length === 0) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground text-sm">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <figure aria-label={ariaLabel} className="group w-full overflow-x-auto">
      <div ref={chartWrapperRef} className="relative" style={{ minWidth }}>
        <ChartContainer
          config={config}
          className="aspect-auto w-full overflow-hidden"
          style={{ height, minWidth }}
        >
          <BarChart
            data={rows}
            margin={{ top: 8, right: 12, left: 12 }}
            onClick={handleClick}
          >
            {hatched.size > 0 ? (
              <HatchPatternDefs keys={keys} idFor={patternIdFor} />
            ) : null}
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <ReferenceLine y={0} stroke="hsl(var(--border))" />
            {referenceLines?.map((referenceLine) => (
              <ReferenceLine
                key={referenceLine.label}
                y={referenceLine.value}
                ifOverflow="extendDomain"
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
                label={{
                  value: referenceLine.label,
                  position: verticalReferenceLabelPosition(
                    referenceLine.value,
                    timeDomain,
                  ),
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 12,
                }}
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
              interval={xTicks ? 0 : xTickInterval}
              tickFormatter={
                xTickFormatter
                  ? (value) => xTickFormatter(Number(value))
                  : undefined
              }
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width="auto"
              tickFormatter={
                valueFormatter
                  ? (value) => valueFormatter(Number(value))
                  : undefined
              }
            />
            <ChartTooltip
              cursor={!pinned}
              active={pinned ? false : undefined}
              content={
                <StackedBarTooltip
                  config={config}
                  valueFormatter={valueFormatter}
                  labelFormatter={labelFormatter ?? xTickFormatter}
                  totalLabel={totalLabel}
                  totalValueForTimestamp={totalValueForTimestamp}
                  referenceLines={referenceLines}
                />
              }
            />
            {showLegend ? <ChartLegend content={renderLegend} /> : null}
            {keys.map((key) => (
              <Bar
                key={key}
                dataKey={key}
                stackId="stack"
                fill={`var(--color-${key})`}
                hide={hiddenSet.has(key)}
                isAnimationActive={false}
                maxBarSize={maxBarSize}
                shape={
                  hatched.size > 0
                    ? (props: BarShapeProps) => (
                        <Rectangle
                          {...props}
                          fill={
                            hatched.has(Number(props.payload?.timestamp))
                              ? `url(#${patternIdFor(key)})`
                              : props.fill
                          }
                        />
                      )
                    : undefined
                }
              />
            ))}
          </BarChart>
        </ChartContainer>

        {pinned ? (
          <StackedBarTooltip
            config={config}
            valueFormatter={valueFormatter}
            labelFormatter={labelFormatter ?? xTickFormatter}
            totalLabel={totalLabel}
            totalValueForTimestamp={totalValueForTimestamp}
            referenceLines={referenceLines}
            active
            payload={pinned.payload}
            label={pinned.label}
            interactive
            onClose={() => setPinned(null)}
            style={{ left: pinned.x, top: pinned.y }}
          />
        ) : null}
      </div>
    </figure>
  );
}
