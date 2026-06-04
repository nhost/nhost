import type { MetricSeries } from '@/features/orgs/projects/common/metrics/types';

export interface NhostFunction {
  path: string;
  route: string;
  runtime: string;
  checksum?: string;
  createdAt: string;
  updatedAt: string;
  functionName: string;
  createdWithCommitSha?: string;
}

export const HTTP_METHODS = [
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'OPTIONS',
  'HEAD',
] as const;

export type HttpMethod = (typeof HTTP_METHODS)[number];

// Tailwind palette pair: light/dark text classes for inline UI, and the
// matching -500 mid-tone HSL for chart lines/swatches. Keep these in sync.
export const HTTP_METHOD_TEXT_CLASSES: Record<HttpMethod, string> = {
  GET: 'text-blue-600 dark:text-blue-400',
  POST: 'text-green-600 dark:text-green-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  PATCH: 'text-pink-600 dark:text-pink-400',
  DELETE: 'text-red-600 dark:text-red-400',
  OPTIONS: 'text-purple-600 dark:text-purple-400',
  HEAD: 'text-teal-600 dark:text-teal-400',
};

export const HTTP_METHOD_CHART_COLORS: Record<HttpMethod, string> = {
  GET: 'hsl(217 91% 60%)',
  POST: 'hsl(142 71% 45%)',
  PUT: 'hsl(38 92% 50%)',
  PATCH: 'hsl(330 81% 60%)',
  DELETE: 'hsl(0 84% 60%)',
  OPTIONS: 'hsl(271 91% 65%)',
  HEAD: 'hsl(173 80% 40%)',
};

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface MultipartField {
  key: string;
  value: string;
  file: File | null;
}

export interface ResponseState {
  status: 'idle' | 'loading' | 'success' | 'error';
  statusCode?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: string;
  duration?: number;
}

export interface ExecuteFormValues {
  method: HttpMethod;
  contentType: string;
  headers: KeyValuePair[];
  params: KeyValuePair[];
  body: string;
  formFields: KeyValuePair[];
  multipartFields: MultipartField[];
}

export const FUNCTION_TABS = [
  'overview',
  'execute',
  'logs',
  'metrics',
] as const;

export type FunctionTab = (typeof FUNCTION_TABS)[number];

export function isFunctionTab(value: unknown): value is FunctionTab {
  return (
    typeof value === 'string' &&
    (FUNCTION_TABS as readonly string[]).includes(value)
  );
}

export interface RequestsTableRow {
  timestamp: string;
  method: string;
  value: number;
}

export interface ErrorsTableRow {
  timestamp: string;
  method: string;
  status: string;
  value: number;
}

export interface FunctionMetricsSummary {
  totalInvocations: number;
  totalBytesSent: number;
  totalDurationSeconds: number;
}

export interface FunctionMetricsResponse {
  summary: FunctionMetricsSummary;
  general: {
    invocationsByMethod: MetricSeries[];
    responseStatus: MetricSeries[];
    averageResponseSize: MetricSeries[];
    totalRequests: RequestsTableRow[];
  };
  responseTimes: {
    max: MetricSeries[];
    p95: MetricSeries[];
    p75: MetricSeries[];
    avg: MetricSeries[];
  };
  errors: {
    errorRate: MetricSeries[];
    totalErrors: ErrorsTableRow[];
  };
}
