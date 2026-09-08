import BillingUsageChart from '@/features/orgs/components/billing/BillingMetricsPreview/components/BillingUsageChart';
import MonthlyServiceSpendChart from '@/features/orgs/components/billing/BillingMetricsPreview/components/MonthlyServiceSpendChart';
import type { BillingMetricsData } from '@/features/orgs/components/billing/BillingMetricsPreview/types';

export interface BillingMetricsChartsProps {
  data: BillingMetricsData;
  refreshing: boolean;
  onRefresh: VoidFunction;
}

export default function BillingMetricsCharts({
  data,
  refreshing,
  onRefresh,
}: BillingMetricsChartsProps) {
  return (
    <div className="flex flex-col gap-4">
      <BillingUsageChart
        data={data}
        refreshing={refreshing}
        onRefresh={onRefresh}
      />
      <MonthlyServiceSpendChart data={data} />
    </div>
  );
}
