import {
  BILLING_USAGE_CHART_VIEWS,
  type BillingUsageChartView,
} from '@/features/orgs/components/billing/BillingUsage/types';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';

const BILLING_USAGE_CHART_VIEW_STORAGE_KEY = 'nhost-billing-usage-chart-view';

const DEFAULT_CHART_VIEW: BillingUsageChartView = 'cumulative';

function isChartView(value: unknown): value is BillingUsageChartView {
  return BILLING_USAGE_CHART_VIEWS.some((view) => view === value);
}

export default function useBillingUsageChartView() {
  const [storedView, setStoredView] = useSSRLocalStorage<unknown>(
    BILLING_USAGE_CHART_VIEW_STORAGE_KEY,
    DEFAULT_CHART_VIEW,
  );
  const view = isChartView(storedView) ? storedView : DEFAULT_CHART_VIEW;
  const setView = (next: BillingUsageChartView) => setStoredView(next);

  return [view, setView] as const;
}
