import type {
  ErrorsTableRow,
  FunctionMetricsResponse,
  RequestsTableRow,
} from '@/features/orgs/projects/serverless-functions/types';
import type { GetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';

export default function transformFunctionMetrics(
  data: GetFunctionsMetricsDashboardQuery,
  to: Date,
): FunctionMetricsResponse {
  const toIso = to.toISOString();

  // Use the dedicated per-method total (one value per method) rather than
  // summing the chart's time series, which would overcount. `Math.ceil`
  // because the total can come back fractional.
  const totalRequests: RequestsTableRow[] = data.totalRequestsByMethod
    .map((v) => ({
      timestamp: toIso,
      method: v.labels.method,
      value: Math.ceil(v.value),
    }))
    .sort((a, b) => b.value - a.value);

  const totalErrors: ErrorsTableRow[] = data.totalErrors
    .map((v) => ({
      timestamp: toIso,
      method: v.labels.method,
      status: v.labels.status,
      value: Math.ceil(v.value),
    }))
    .sort((a, b) => b.value - a.value);

  return {
    summary: {
      totalInvocations: data.totalInvocations[0]?.value ?? 0,
      totalBytesSent: data.totalBytesSent[0]?.value ?? 0,
      totalDurationSeconds: data.totalDuration[0]?.value ?? 0,
    },
    general: {
      invocationsByMethod: data.invocations,
      responseStatus: data.responseStatus,
      averageResponseSize: data.averageResponseSize,
      totalRequests,
    },
    responseTimes: {
      max: data.durationMax,
      p95: data.durationP95,
      p75: data.durationP75,
      avg: data.averageResponseTime,
    },
    errors: {
      errorRate: data.errorRate,
      totalErrors,
    },
  };
}
