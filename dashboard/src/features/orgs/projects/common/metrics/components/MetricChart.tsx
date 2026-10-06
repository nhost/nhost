import { useCallback, useMemo, useRef, useState } from 'react';
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
  PinnedTooltip,
  TOOLTIP_WRAPPER_STYLE,
} from '@/features/orgs/projects/common/metrics/components/MetricChartTooltip';
import ScaleCapture from '@/features/orgs/projects/common/metrics/components/ScaleCapture';
import { useDragToZoom } from '@/features/orgs/projects/common/metrics/hooks/useDragToZoom';
import { usePinnedTooltip } from '@/features/orgs/projects/common/metrics/hooks/usePinnedTooltip';
import { useSeriesVisibility } from '@/features/orgs/projects/common/metrics/hooks/useSeriesVisibility';
import { useTimeAxis } from '@/features/orgs/projects/common/metrics/hooks/useTimeAxis';
import type {
  ChartMouseEvent,
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

  const { hiddenSet, handleLegendClick } = useSeriesVisibility({
    keys,
    hiddenKeys,
    onHiddenKeysChange,
  });
  const pin = usePinnedTooltip({ rows, keys, hiddenSet, config });
  const zoom = useDragToZoom({
    minRange: MIN_ZOOM_RANGE_MS,
    onZoomRange: (from, to) => {
      pin.clearPinned();
      onZoomRange?.(from, to);
    },
  });

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

  const isEmpty = rows.length === 0 || keys.length === 0;

  const handleMouseMove = (e: ChartMouseEvent) => {
    updateFocusedKey(e);
    zoom.handleMouseMove(e);
  };

  const handleMouseLeave = () => {
    setFocusedKey(null);
  };

  const handleClick = (e: ChartMouseEvent) => {
    if (!zoom.consumeDragClick()) {
      pin.togglePinAt(e);
    }
  };

  const handleDoubleClick = () => {
    pin.clearPinned();
    onZoomOut?.();
  };

  const chartProps = {
    data: rows,
    onMouseDown: zoom.handleMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: zoom.handleMouseUp,
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
          ref={pin.wrapperRef}
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
                cursor={!pin.pinned}
                active={pin.pinned ? false : undefined}
                wrapperStyle={TOOLTIP_WRAPPER_STYLE}
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
              {zoom.selection ? (
                <ReferenceArea
                  x1={zoom.selection.from}
                  x2={zoom.selection.to}
                  strokeOpacity={0.3}
                  fillOpacity={0.1}
                />
              ) : null}
            </LineChart>
          </ChartContainer>

          {pin.pinned ? (
            <PinnedTooltip
              pinned={pin.pinned}
              config={config}
              valueFormatter={valueFormatter}
              onClose={pin.clearPinned}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}
