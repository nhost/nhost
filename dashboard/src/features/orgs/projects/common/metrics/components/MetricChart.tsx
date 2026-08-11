import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  type DefaultLegendContentProps,
  Line,
  LineChart,
  ReferenceArea,
  type ScaleFunction,
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
  type PinnedPayloadEntry,
  type PinnedState,
  PinnedTooltip,
  resolveTooltipPosition,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import ScaleCapture from '@/features/orgs/projects/common/metrics/components/ScaleCapture';
import { useTimeAxis } from '@/features/orgs/projects/common/metrics/hooks/useTimeAxis';
import type {
  MetricSeries,
  SeriesAccessors,
} from '@/features/orgs/projects/common/metrics/types';
import { buildChart } from '@/features/orgs/projects/common/metrics/utils/buildChart';
import { distanceSqToSeries } from '@/features/orgs/projects/common/metrics/utils/seriesGeometry';

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

interface ChartMouseEvent {
  activeLabel?: string | number;
  activeTooltipIndex?: number | string | null;
  activeCoordinate?: { x?: number; y?: number };
  chartX?: number;
  chartY?: number;
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

  const [refAreaLeft, setRefAreaLeft] = useState<number | null>(null);
  const [refAreaRight, setRefAreaRight] = useState<number | null>(null);
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
    const timestampMs = Number(e?.activeLabel);
    if (Number.isNaN(timestampMs)) {
      return;
    }
    setRefAreaLeft(timestampMs);
    setRefAreaRight(null);
    justDraggedRef.current = false;
  };

  const handleMouseMove = (e: ChartMouseEvent) => {
    updateFocusedKey(e);
    if (refAreaLeft === null) {
      return;
    }
    const timestampMs = Number(e?.activeLabel);
    if (Number.isNaN(timestampMs)) {
      return;
    }
    if (timestampMs !== refAreaLeft) {
      justDraggedRef.current = true;
    }
    setRefAreaRight(timestampMs);
  };

  const handleMouseLeave = () => {
    setFocusedKey(null);
  };

  const handleMouseUp = () => {
    const ll = refAreaLeft;
    const rr = refAreaRight;
    setRefAreaLeft(null);
    setRefAreaRight(null);
    if (ll === null || rr === null || ll === rr) {
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

  const renderLegend = ({ payload }: DefaultLegendContentProps) =>
    payload?.length ? (
      <InteractiveChartLegend
        payload={payload}
        config={config}
        hiddenSet={hiddenSet}
        onItemClick={handleLegendClick}
        onItemHover={setLegendHover}
      />
    ) : null;

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
                  valueFormatter
                    ? (tickValue) => valueFormatter(Number(tickValue))
                    : undefined
                }
              />
              <ChartTooltip
                cursor={!pinned}
                active={pinned ? false : undefined}
                content={tooltipContent}
              />
              <ChartLegend content={renderLegend} />
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
              {refAreaLeft !== null && refAreaRight !== null ? (
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
