import type { RefObject } from 'react';
import { type ScaleFunction, useXAxisScale, useYAxisScale } from 'recharts';

// Captures recharts' internal x/y axis scales into refs so the parent chart can
// project cursor coordinates back into data space (used for nearest-series
// focus detection). Renders nothing.
export default function ScaleCapture({
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
