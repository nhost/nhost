import {
  FancyMultiSelect,
  type Option,
} from '@/components/ui/v3/fancy-multi-select';
import { humanizeLabelDimension } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/panels';
import type { MetricPanelFilter } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/types';
import { uniqueLabelValues } from '@/features/orgs/projects/serverless-functions/components/MetricsTab/utils/applyMetricFilter';
import type { MetricSeries } from '@/features/orgs/projects/serverless-functions/types';

export interface MetricPanelFilterBarProps {
  labelDimensions: string[];
  data: MetricSeries[];
  filter: MetricPanelFilter;
  onChange: (filter: MetricPanelFilter) => void;
}

export default function MetricPanelFilterBar({
  labelDimensions,
  data,
  filter,
  onChange,
}: MetricPanelFilterBarProps) {
  if (labelDimensions.length === 0) {
    return null;
  }

  const handleDimChange = (dim: string, selected: Option[]) => {
    const values = selected.map((o) => o.value);
    const next: MetricPanelFilter = { ...filter };
    if (values.length === 0) {
      delete next[dim];
    } else {
      next[dim] = values;
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted-foreground text-xs uppercase tracking-wide">
        Filter by
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {labelDimensions.map((dim) => {
          const options: Option[] = uniqueLabelValues(data, dim).map((v) => ({
            value: v,
            label: v,
          }));
          const selected: Option[] = (filter[dim] ?? []).map((v) => ({
            value: v,
            label: v,
          }));
          return (
            <div key={dim} className="flex flex-col gap-1">
              <span className="font-medium text-foreground text-xs">
                {humanizeLabelDimension(dim)}
              </span>
              {options.length === 0 ? (
                <p className="rounded-md border bg-muted/30 px-3 py-2 text-muted-foreground text-xs">
                  No values available.
                </p>
              ) : (
                <FancyMultiSelect
                  value={selected}
                  options={options}
                  onChange={(next) => handleDimChange(dim, next)}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
