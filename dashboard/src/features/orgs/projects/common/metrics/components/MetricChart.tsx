import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  type ScaleFunction,
  useXAxisScale,
  useYAxisScale,
  XAxis,
  YAxis,
} from 'recharts';
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartTooltip,
} from '@/components/ui/v3/chart';
import useTimeAxis from '@/features/orgs/projects/common/metrics/hooks/useTimeAxis';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { buildChart } from '@/features/orgs/projects/common/metrics/utils/buildChart';
import { formatTimestampFull } from '@/features/orgs/projects/common/metrics/utils/formatters';
import { distanceSqToSeries } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';
import { cn } from '@/lib/utils';

export interface MetricChartProps {
  data: MetricSeries[];
  accessors: SeriesAccessors;
  valueFormatter?: (v: number) => string;
  height?: number;
  // Explicit [fromMs, toMs] for the XAxis so the full requested window renders
  xDomain?: [number, number];
  onZoomRange?: (fromMs: number, toMs: number) => void;
  onZoomOut?: () => void;
  // Optional controlled visibility. When omitted, the chart self-manages hidden
  // series via internal state (resets on unmount).
  hiddenKeys?: string[];
  onHiddenKeysChange?: (next: string[]) => void;
}

interface PinnedState {
  x: number;
  y: number;
  label: number;
  payload: PinnedPayloadEntry[];
}

interface ChartMouseEvent {
  activeLabel?: string | number;
  activeTooltipIndex?: number | string | null;
  activeCoordinate?: { x?: number; y?: number };
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

export default function MetricChart({
  data,
  accessors,
  valueFormatter,
  height = 260,
  xDomain,
  onZoomRange,
  onZoomOut,
  hiddenKeys,
  onHiddenKeysChange,
}: MetricChartProps) {
  const { keys, rows, config } = useMemo(
    () => buildChart(data, accessors),
    [data, accessors],
  );

  const { ticks, tickFormatter } = useTimeAxis(xDomain);

  const [internalHidden, setInternalHidden] = useState<string[]>([]);
  const hidden = hiddenKeys ?? internalHidden;
  const setHidden = useCallback(
    (next: string[]) => {
      if (onHiddenKeysChange) {
        onHiddenKeysChange(next);
      }
      if (hiddenKeys === undefined) {
        setInternalHidden(next);
      }
    },
    [onHiddenKeysChange, hiddenKeys],
  );
  const hiddenSet = useMemo(() => new Set(hidden), [hidden]);

  const handleLegendClick = useCallback(
    (
      key: string,
      opts: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
    ) => {
      if (opts.metaKey || opts.ctrlKey || opts.shiftKey) {
        const next = hiddenSet.has(key)
          ? hidden.filter((k) => k !== key)
          : [...hidden, key];
        const nextSet = new Set(next);
        const visibleAfter = keys.filter((k) => !nextSet.has(k));
        setHidden(visibleAfter.length === 0 ? [] : next);
        return;
      }
      const visible = keys.filter((k) => !hiddenSet.has(k));
      if (visible.length === 1 && visible[0] === key) {
        setHidden([]);
        return;
      }
      setHidden(keys.filter((k) => k !== key));
    },
    [hidden, hiddenSet, keys, setHidden],
  );

  const [refAreaLeft, setRefAreaLeft] = useState<number | ''>('');
  const [refAreaRight, setRefAreaRight] = useState<number | ''>('');
  const justDraggedRef = useRef(false);

  const [pinned, setPinned] = useState<PinnedState | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement | null>(null);

  const [focusedKey, setFocusedKey] = useState<string | null>(null);
  const xScaleRef = useRef<ScaleFunction | null>(null);
  const yScaleRef = useRef<ScaleFunction | null>(null);
  const legendHoverRef = useRef<string | null>(null);

  const setLegendHover = useCallback((key: string | null) => {
    legendHoverRef.current = key;
    setFocusedKey((prev) => (prev === key ? prev : key));
  }, []);

  const updateFocusedKey = useCallback(
    (e: ChartMouseEvent) => {
      // Legend hover takes priority — the recharts-wrapper catches mouse
      // moves over the legend area too (legend is portaled inside it), so
      // without this guard the chart's mouse-move would constantly clear
      // the focus that the legend just set.
      if (legendHoverRef.current !== null) {
        return;
      }
      const cursorX = e?.activeCoordinate?.x;
      const cursorY = e?.activeCoordinate?.y;
      const xScale = xScaleRef.current;
      const yScale = yScaleRef.current;
      if (cursorX == null || cursorY == null || !xScale || !yScale) {
        setFocusedKey((prev) => (prev === null ? prev : null));
        return;
      }
      let bestKey: string | null = null;
      let bestDistSq = Number.POSITIVE_INFINITY;
      for (const key of keys) {
        if (hiddenSet.has(key)) {
          continue;
        }
        const distSq = distanceSqToSeries(
          key,
          cursorX,
          cursorY,
          rows,
          xScale,
          yScale,
        );
        if (distSq < bestDistSq) {
          bestDistSq = distSq;
          bestKey = key;
        }
      }
      setFocusedKey((prev) => (prev === bestKey ? prev : bestKey));
    },
    [keys, rows, hiddenSet],
  );

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
    const v = Number(e?.activeLabel);
    if (Number.isNaN(v)) {
      return;
    }
    setRefAreaLeft(v);
    setRefAreaRight('');
    justDraggedRef.current = false;
  };

  const handleMouseMove = (e: ChartMouseEvent) => {
    updateFocusedKey(e);
    if (refAreaLeft === '') {
      return;
    }
    const v = Number(e?.activeLabel);
    if (Number.isNaN(v)) {
      return;
    }
    if (v !== refAreaLeft) {
      justDraggedRef.current = true;
    }
    setRefAreaRight(v);
  };

  const handleMouseLeave = () => {
    setFocusedKey(null);
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

  const handleClick = (e: ChartMouseEvent) => {
    if (justDraggedRef.current) {
      justDraggedRef.current = false;
      return;
    }
    const label = Number(e?.activeLabel);
    const row = rows.find((r) => r.timestamp === label);

    if (e?.activeTooltipIndex == null || !row) {
      setPinned(null);
      return;
    }

    const { x, y } = resolveTooltipPosition(chartWrapperRef.current, e);
    if (x == null || y == null) {
      setPinned(null);
      return;
    }

    const payload: PinnedPayloadEntry[] = keys
      .filter((key) => !hiddenSet.has(key))
      .map((key) => ({
        dataKey: key,
        name: key,
        value: row[key] ?? undefined,
        color: config[key]?.color,
      }))
      .filter((p) => p.value !== undefined);

    if (payload.length === 0) {
      setPinned(null);
      return;
    }

    setPinned((prev) => (prev ? null : { x, y, label, payload }));
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
    onMouseLeave: handleMouseLeave,
    onClick: handleClick,
    onDoubleClick: handleDoubleClick,
    margin: { top: 8, right: 12, left: 12, bottom: 8 },
  } as const;

  const tooltipContent = (
    <HoverTooltipContent config={config} valueFormatter={valueFormatter} />
  );

  return (
    <div className="flex flex-col gap-2">
      {isEmpty ? (
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-muted-foreground text-sm">No data available.</p>
        </div>
      ) : (
        <div
          className="relative [&_.recharts-wrapper:focus-visible]:outline-none [&_.recharts-wrapper:focus]:outline-none [&_.recharts-wrapper]:outline-none"
          ref={chartWrapperRef}
        >
          <ChartContainer
            config={config}
            className="aspect-auto w-full select-none"
            style={{ height }}
          >
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
                width="auto"
                tickFormatter={
                  valueFormatter ? (v) => valueFormatter(Number(v)) : undefined
                }
              />
              <ChartTooltip
                cursor={!pinned}
                active={pinned ? false : undefined}
                content={tooltipContent}
              />
              <ChartLegend
                content={
                  <InteractiveChartLegend
                    config={config}
                    hiddenSet={hiddenSet}
                    onItemClick={handleLegendClick}
                    onItemHover={setLegendHover}
                  />
                }
              />
              <ScaleCapture xScaleRef={xScaleRef} yScaleRef={yScaleRef} />
              {keys.map((key) => (
                <Line
                  key={key}
                  type="linear"
                  dataKey={key}
                  stroke={`var(--color-${key})`}
                  strokeWidth={1.8}
                  dot={false}
                  isAnimationActive={false}
                  hide={hiddenSet.has(key)}
                  zIndex={focusedKey === key ? 500 : undefined}
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
  label: ReactNode;
  value: number | string | undefined;
  color: string;
}

function toEntries(
  payload: PinnedPayloadEntry[],
  config: ChartConfig,
): TooltipEntry[] {
  return payload
    .filter((p) => p.type !== 'none' && p.value != null)
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
  style?: CSSProperties;
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
        <button
          type="button"
          onClick={onClose}
          className={cn(
            'shrink-0 text-muted-foreground hover:text-foreground',
            !onClose && 'pointer-events-none invisible',
          )}
          aria-label="Close pinned tooltip"
          aria-hidden={!onClose}
          tabIndex={onClose ? 0 : -1}
        >
          ×
        </button>
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
      }}
      testId="pinned-tooltip"
      ariaLabel="Pinned data point"
    />
  );
}

// Mirror the hover tooltip's placement (including recharts' edge-flipping) by
// reading the live transform recharts set on its tooltip wrapper. Falls back
// to activeCoordinate + default offset if the wrapper hasn't been positioned
// yet (e.g., click without a prior hover).
function resolveTooltipPosition(
  wrapperEl: HTMLDivElement | null,
  e: ChartMouseEvent,
): { x: number | null; y: number | null } {
  const tooltipEl = wrapperEl?.querySelector(
    '.recharts-tooltip-wrapper',
  ) as HTMLElement | null;
  if (tooltipEl && tooltipEl.style.visibility !== 'hidden') {
    const match = tooltipEl.style.transform.match(
      /translate\(\s*(-?[\d.]+)px\s*,\s*(-?[\d.]+)px\s*\)/,
    );
    if (match) {
      return {
        x: Number.parseFloat(match[1]),
        y: Number.parseFloat(match[2]),
      };
    }
  }
  const fallbackX = e.activeCoordinate?.x ?? e.chartX;
  const fallbackY = e.activeCoordinate?.y ?? e.chartY;
  return {
    x: fallbackX != null ? fallbackX + 10 : null,
    y: fallbackY != null ? fallbackY + 10 : null,
  };
}

interface LegendPayloadItem {
  dataKey?: string | number;
  color?: string;
  type?: string;
}

interface InteractiveChartLegendProps {
  config: ChartConfig;
  hiddenSet: Set<string>;
  onItemClick: (
    key: string,
    opts: { metaKey: boolean; ctrlKey: boolean; shiftKey: boolean },
  ) => void;
  onItemHover?: (key: string | null) => void;
  payload?: LegendPayloadItem[];
}

function InteractiveChartLegend({
  config,
  hiddenSet,
  onItemClick,
  onItemHover,
  payload,
}: InteractiveChartLegendProps) {
  if (!payload?.length) {
    return null;
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
      {payload
        .filter((item) => item.type !== 'none')
        .map((item) => {
          const key = String(item.dataKey ?? '');
          const isHidden = hiddenSet.has(key);
          const label = config[key]?.label ?? key;
          return (
            <button
              key={key}
              type="button"
              onClick={(e) =>
                onItemClick(key, {
                  metaKey: e.metaKey,
                  ctrlKey: e.ctrlKey,
                  shiftKey: e.shiftKey,
                })
              }
              onDoubleClick={(e) => e.stopPropagation()}
              onMouseEnter={() => onItemHover?.(key)}
              onMouseLeave={() => onItemHover?.(null)}
              className={cn(
                'flex cursor-pointer items-center gap-1.5 text-xs leading-none transition-colors hover:text-foreground',
                isHidden ? 'text-muted-foreground/60' : 'text-foreground',
              )}
              aria-pressed={!isHidden}
              title="Click to isolate, click again to restore. Hold ⌘/Ctrl/Shift to toggle individually."
            >
              <div
                className={cn(
                  'h-2 w-2 shrink-0 rounded-[2px] transition-opacity',
                  isHidden && 'opacity-40',
                )}
                style={{ backgroundColor: item.color }}
              />
              <span>{label}</span>
            </button>
          );
        })}
    </div>
  );
}

function ScaleCapture({
  xScaleRef,
  yScaleRef,
}: {
  xScaleRef: RefObject<ScaleFunction | null>;
  yScaleRef: RefObject<ScaleFunction | null>;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  xScaleRef.current = xScale ?? null;
  yScaleRef.current = yScale ?? null;
  return null;
}
