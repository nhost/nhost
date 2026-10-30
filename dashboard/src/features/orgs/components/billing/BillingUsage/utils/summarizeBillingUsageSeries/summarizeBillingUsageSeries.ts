import type { BillingUsageSummary } from '@/features/orgs/components/billing/BillingUsage/types';
import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

export default function summarizeBillingUsageSeries(
  dailySeries: MetricSeries[],
): BillingUsageSummary {
  const projectTotals = dailySeries.map((series) => ({
    isDeleted: series.labels.projectKind === 'deleted',
    total: sumOf(series.datapoints),
  }));
  const total = sumOf(projectTotals.map((project) => project.total));
  if (total <= 0) {
    return { total };
  }

  const deletedProjects = projectTotals.filter(
    (project) => project.isDeleted && project.total > 0,
  );
  const deletedTotal = sumOf(deletedProjects.map((project) => project.total));

  return {
    total,
    deletedProjects:
      deletedProjects.length > 0
        ? {
            count: deletedProjects.length,
            total: deletedTotal,
            percentage: (deletedTotal / total) * 100,
          }
        : undefined,
  };
}

function sumOf(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0);
}
