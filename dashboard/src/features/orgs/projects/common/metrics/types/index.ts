// Shared, domain-agnostic types for the metrics charting toolkit. Reused across
// project features (serverless functions today; Auth/Database metrics next), so
// nothing here may depend on a specific feature's data shape.

// A single metric series: a set of labels plus index-aligned timestamp and
// datapoint arrays.
export interface MetricSeries {
  labels: Record<string, string>;
  timestamps: string[];
  datapoints: number[];
}

// How a chart derives a series' key, legend label, and color from its labels.
// Concrete accessors (e.g. by HTTP method/status) live with their owning
// feature; the chart only depends on this interface.
export interface SeriesAccessors {
  keyFor: (labels: Record<string, string>) => string;
  labelFor: (key: string, labels: Record<string, string>) => string;
  colorFor: (
    key: string,
    labels: Record<string, string>,
    index: number,
  ) => string;
}

// The subset of a Recharts chart mouse event the interaction hooks read.
export interface ChartMouseEvent {
  activeLabel?: string | number;
  activeTooltipIndex?: number | string | null;
  activeCoordinate?: { x?: number; y?: number };
  chartX?: number;
  chartY?: number;
}

export interface PinnedPayloadEntry {
  dataKey?: string | number;
  name?: string | number;
  value?: number | string;
  color?: string | undefined;
  payload?: { fill?: string };
  type?: string;
}

export interface PinnedState {
  x: number;
  y: number;
  label: number;
  payload: PinnedPayloadEntry[];
}
