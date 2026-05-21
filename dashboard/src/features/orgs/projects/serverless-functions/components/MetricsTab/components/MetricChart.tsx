import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
} from '@/components/ui/v3/chart';
import { buildChartConfig } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/buildChartConfig';
import { buildTimeTicks } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/buildTimeTicks';
import {
  formatTimestampDateTick,
  formatTimestampFull,
  formatTimestampTick,
} from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/formatters';
import { mergeSeries } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/mergeSeries';
import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';
import { cn } from '@/lib/utils';

export interface MetricChartProps {
  kind?: 'line' | 'area-stacked';
  data: MetricSeries[];
  seriesKeyFor: (labels: Record<string, string>) => string;
  seriesLabelFor?: (key: string, labels: Record<string, string>) => string;
  colorFor?: (
    key: string,
    labels: Record<string, string>,
    index: number,
  ) => string | undefined;
  valueFormatter?: (v: number) => string;
  connectNulls?: boolean;
  height?: number;
  className?: string;
  // Explicit [fromMs, toMs] for the XAxis so the full requested window renders
  xDomain?: [number, number];
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
}

interface PinnedState {
  index: string;
  x: number;
  y: number;
  label: number;
  payload: PinnedPayloadEntry[];
}

interface ChartMouseEvent {
  activeLabel?: string | number;
  activeTooltipIndex?: number | string | null;
  activePayload?: PinnedPayloadEntry[];
  chartX?: number;
  chartY?: number;
}

interface PinnedPayloadEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string | undefined;
  payload?: { fill?: string };
  type?: string;
}

// Ignore drag selections shorter than this — prevents accidental hairline
// zooms from a near-zero drag distance.
const MIN_ZOOM_RANGE_MS = 10_000;

const DAY_MS = 24 * 60 * 60_000;

export default function MetricChart({
  kind = 'line',
  data,
  seriesKeyFor,
  seriesLabelFor,
  colorFor,
  valueFormatter,
  connectNulls = false,
  height = 260,
  className,
  xDomain,
  onZoomRange,
  onZoomOut,
}: MetricChartProps) {
  const { keys, rows } = useMemo(
    () => mergeSeries(data, seriesKeyFor),
    [data, seriesKeyFor],
  );

  const config: ChartConfig = useMemo(
    () =>
      buildChartConfig(data, {
        keyFor: seriesKeyFor,
        labelFor: seriesLabelFor,
        colorFor,
      }),
    [data, seriesKeyFor, seriesLabelFor, colorFor],
  );

  const ticks = useMemo(
    () => (xDomain ? buildTimeTicks(xDomain) : undefined),
    [xDomain],
  );

  const tickFormatter = useMemo(() => {
    if (!xDomain) {
      return formatTimestampTick;
    }
    return xDomain[1] - xDomain[0] > DAY_MS
      ? formatTimestampDateTick
      : formatTimestampTick;
  }, [xDomain]);

  const [refAreaLeft, setRefAreaLeft] = useState<number | ''>('');
  const [refAreaRight, setRefAreaRight] = useState<number | ''>('');

  const [pinned, setPinned] = useState<PinnedState | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pinned) {
      return undefined;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPinned(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pinned]);

  const isEmpty = rows.length === 0 || keys.length === 0;

  const handleMouseDown = (e: ChartMouseEvent) => {
    const v = toNumber(e?.activeLabel);
    if (v === null) {
      return;
    }
    setRefAreaLeft(v);
    setRefAreaRight('');
  };

  const handleMouseMove = (e: ChartMouseEvent) => {
    if (refAreaLeft === '') {
      return;
    }
    const v = toNumber(e?.activeLabel);
    if (v === null) {
      return;
    }
    setRefAreaRight(v);
  };

  const handleMouseUp = () => {
    const ll = refAreaLeft;
    const rr = refAreaRight;
    setRefAreaLeft('');
    setRefAreaRight('');
    if (ll === '' || rr === '' || ll === rr) {
      return;
    }
    const [from, to] = ll < rr ? [ll, rr] : [rr, ll];
    if (to - from < MIN_ZOOM_RANGE_MS) {
      return;
    }
    setPinned(null);
    onZoomRange?.(from, to);
  };

  const handleClick = (
    e: ChartMouseEvent,
    nativeEvent?: React.MouseEvent<Element>,
  ) => {
    const label = toNumber(e?.activeLabel);
    const rawIndex = e?.activeTooltipIndex;
    const idx =
      rawIndex == null
        ? null
        : typeof rawIndex === 'string'
          ? rawIndex
          : String(rawIndex);

    const row =
      label !== null ? rows.find((r) => r.timestamp === label) : undefined;

    const rect = chartWrapperRef.current?.getBoundingClientRect();
    const relX = rect && nativeEvent ? nativeEvent.clientX - rect.left : null;
    const relY = rect && nativeEvent ? nativeEvent.clientY - rect.top : null;

    if (
      idx === null ||
      label === null ||
      !row ||
      relX === null ||
      relY === null
    ) {
      setPinned(null);
      return;
    }

    const payload: PinnedPayloadEntry[] = keys
      .map((key) => ({
        dataKey: key,
        name: key,
        value: row[key] ?? undefined,
        color: config[key]?.color,
      }))
      .filter((p) => p.value !== undefined);

    setPinned((prev) =>
      prev && prev.index === idx
        ? null
        : { index: idx, x: relX, y: relY, label, payload },
    );
  };

  const handleDoubleClick = () => {
    setPinned(null);
    onZoomOut?.();
  };

  const chartProps = {
    data: rows,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    margin: { top: 8, right: 12, left: 12, bottom: 8 },
  } as const;

  const tooltipContent = (
    <HoverTooltipContent config={config} valueFormatter={valueFormatter} />
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-muted-foreground text-sm">No data available.</p>
        </div>
      ) : (
        <div className="relative" ref={chartWrapperRef}>
          <ChartContainer
            config={config}
            className="aspect-auto w-full select-none"
            style={{ height }}
          >
            {kind === 'area-stacked' ? (
              <AreaChart {...chartProps}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={xDomain ?? ['dataMin', 'dataMax']}
                  ticks={ticks}
                  tickFormatter={tickFormatter}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={
                    valueFormatter
                      ? (v) => valueFormatter(Number(v))
                      : undefined
                  }
                />
                <ChartTooltip
                  cursor={!pinned}
                  active={pinned ? false : undefined}
                  content={tooltipContent}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {keys.map((key) => (
                  <Area
                    key={key}
                    type="linear"
                    dataKey={key}
                    stackId="a"
                    stroke={`var(--color-${key})`}
                    fill={`var(--color-${key})`}
                    fillOpacity={0.35}
                    strokeWidth={1.5}
                    isAnimationActive={false}
                    connectNulls={connectNulls}
                  />
                ))}
                {refAreaLeft !== '' && refAreaRight !== '' ? (
                  <ReferenceArea
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    strokeOpacity={0.3}
                    fillOpacity={0.1}
                  />
                ) : null}
              </AreaChart>
            ) : (
              <LineChart {...chartProps}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  scale="time"
                  domain={xDomain ?? ['dataMin', 'dataMax']}
                  ticks={ticks}
                  tickFormatter={tickFormatter}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={40}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={
                    valueFormatter
                      ? (v) => valueFormatter(Number(v))
                      : undefined
                  }
                />
                <ChartTooltip
                  cursor={!pinned}
                  active={pinned ? false : undefined}
                  content={tooltipContent}
                />
                <ChartLegend content={<ChartLegendContent />} />
                {keys.map((key) => (
                  <Line
                    key={key}
                    type="linear"
                    dataKey={key}
                    stroke={`var(--color-${key})`}
                    strokeWidth={1.8}
                    dot={false}
                    isAnimationActive={false}
                    connectNulls={connectNulls}
                  />
                ))}
                {refAreaLeft !== '' && refAreaRight !== '' ? (
                  <ReferenceArea
                    x1={refAreaLeft}
                    x2={refAreaRight}
                    strokeOpacity={0.3}
                    fillOpacity={0.1}
                  />
                ) : null}
              </LineChart>
            )}
          </ChartContainer>

          {pinned ? (
            <PinnedTooltip
              pinned={pinned}
              config={config}
              valueFormatter={valueFormatter}
              onClose={() => setPinned(null)}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

interface TooltipEntry {
  key: string;
  label: React.ReactNode;
  value: number | string | undefined;
  color: string;
}

function toEntries(
  payload: PinnedPayloadEntry[],
  config: ChartConfig,
): TooltipEntry[] {
  return payload
    .filter((p) => p.type !== 'none')
    .map((p) => {
      const key = String(p.dataKey ?? p.name ?? 'value');
      return {
        key,
        label: config[key]?.label ?? p.name ?? key,
        value: p.value,
        color: p.color ?? p.payload?.fill ?? 'hsl(var(--muted-foreground))',
      };
    });
}

interface TooltipCardProps {
  label: number | string | undefined;
  entries: TooltipEntry[];
  valueFormatter?: (v: number) => string;
  onClose?: VoidFunction;
  className?: string;
  style?: React.CSSProperties;
  interactive?: boolean;
  testId?: string;
  ariaLabel?: string;
}

function TooltipCard({
  label,
  entries,
  valueFormatter,
  onClose,
  className,
  style,
  interactive = false,
  testId,
  ariaLabel,
}: TooltipCardProps) {
  return (
    <div
      className={cn(
        'grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-foreground text-xs shadow-xl',
        interactive && 'pointer-events-auto select-text',
        className,
      )}
      style={style}
      data-testid={testId}
      {...(onClose ? { role: 'dialog', 'aria-label': ariaLabel } : {})}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-medium">{formatTimestampFull(label)}</div>
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
        {entries.map((entry) => {
          const display =
            typeof entry.value === 'number'
              ? (valueFormatter?.(entry.value) ?? entry.value.toLocaleString())
              : String(entry.value ?? '');
          return (
            <div key={entry.key} className="flex w-full items-center gap-2">
              <div
                className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: entry.color }}
              />
              <div className="flex flex-1 items-center justify-between gap-4 leading-none">
                <span className="text-muted-foreground">{entry.label}</span>
                <span className="font-medium font-mono text-foreground tabular-nums">
                  {display}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface HoverTooltipContentProps {
  config: ChartConfig;
  valueFormatter?: (v: number) => string;
  active?: boolean;
  payload?: PinnedPayloadEntry[];
  label?: number | string;
}

function HoverTooltipContent({
  config,
  valueFormatter,
  active,
  payload,
  label,
}: HoverTooltipContentProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entries = toEntries(payload, config);
  if (entries.length === 0) {
    return null;
  }
  return (
    <TooltipCard
      label={label}
      entries={entries}
      valueFormatter={valueFormatter}
    />
  );
}

interface PinnedTooltipProps {
  pinned: PinnedState;
  config: ChartConfig;
  valueFormatter?: (v: number) => string;
  onClose: VoidFunction;
}

function PinnedTooltip({
  pinned,
  config,
  valueFormatter,
  onClose,
}: PinnedTooltipProps) {
  return (
    <TooltipCard
      label={pinned.label}
      entries={toEntries(pinned.payload, config)}
      valueFormatter={valueFormatter}
      onClose={onClose}
      interactive
      className="absolute z-10"
      style={{
        left: pinned.x,
        top: pinned.y,
        transform: 'translate(8px, -100%)',
      }}
      testId="pinned-tooltip"
      ariaLabel="Pinned data point"
    />
  );
}

function toNumber(input: unknown): number | null {
  if (input == null) {
    return null;
  }
  const n = typeof input === 'number' ? input : Number(input);
  return Number.isFinite(n) ? n : null;
}
