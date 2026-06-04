import type { FunctionMetricsResponse } from '@/features/orgs/projects/serverless-functions/types';
import type { GetFunctionsMetricsDashboardQuery } from '@/utils/__generated__/graphql';
import transformFunctionMetrics from './transformFunctionMetrics';

const TIMESTAMPS = [
  '2026-04-19T12:00:00Z',
  '2026-04-19T12:01:00Z',
  '2026-04-19T12:02:00Z',
];

const TO = new Date('2026-04-19T12:02:00Z');
const TO_ISO = TO.toISOString();

const FIXTURE: GetFunctionsMetricsDashboardQuery = {
  totalInvocations: [{ labels: {}, value: 9035642 }],
  totalBytesSent: [{ labels: {}, value: 23445667800 }],
  totalDuration: [{ labels: {}, value: 12834.5 }],
  totalErrors: [
    { labels: { method: 'POST', status: '500' }, value: 142 },
    { labels: { method: 'GET', status: '404' }, value: 38 },
  ],
  // Instant per-method totals — deliberately unrelated to the `invocations`
  // range datapoints below, so the test proves the table reads this field (not
  // the summed series) and applies `Math.ceil`.
  totalRequestsByMethod: [
    { labels: { method: 'GET' }, value: 10.2 },
    { labels: { method: 'POST' }, value: 3 },
    { labels: { method: 'OPTIONS' }, value: 2.4 },
  ],
  invocations: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [343, 408, 453],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [9678, 9674, 9473],
    },
    {
      labels: { method: 'OPTIONS' },
      timestamps: TIMESTAMPS,
      datapoints: [170, 261, 314],
    },
  ],
  responseStatus: [
    {
      labels: { status: '200' },
      timestamps: TIMESTAMPS,
      datapoints: [10081, 10257, 10164],
    },
    {
      labels: { status: '404' },
      timestamps: TIMESTAMPS,
      datapoints: [8, 11, 9],
    },
    {
      labels: { status: '500' },
      timestamps: TIMESTAMPS,
      datapoints: [2, 3, 1],
    },
  ],
  averageResponseSize: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [2480, 2510, 2495],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [4120, 4205, 4188],
    },
  ],
  averageResponseTime: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [0.042, 0.045, 0.044],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [0.089, 0.091, 0.087],
    },
  ],
  errorRate: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [0.012, 0.015, 0.013],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [0.008, 0.011, 0.009],
    },
  ],
  durationP75: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [0.4716, 0.4641, 0.453],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [0.231, 0.224, 0.219],
    },
  ],
  durationP95: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [0.682, 0.671, 0.659],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [0.412, 0.401, 0.389],
    },
  ],
  durationMax: [
    {
      labels: { method: 'GET' },
      timestamps: TIMESTAMPS,
      datapoints: [0.948, 0.932, 0.917],
    },
    {
      labels: { method: 'POST' },
      timestamps: TIMESTAMPS,
      datapoints: [0.587, 0.572, 0.561],
    },
  ],
};

describe('transformFunctionMetrics', () => {
  it('maps the raw response to FunctionMetricsResponse', () => {
    const result = transformFunctionMetrics(FIXTURE, TO);

    const expected: FunctionMetricsResponse = {
      summary: {
        totalInvocations: 9035642,
        totalBytesSent: 23445667800,
        totalDurationSeconds: 12834.5,
      },
      general: {
        invocationsByMethod: FIXTURE.invocations,
        responseStatus: FIXTURE.responseStatus,
        averageResponseSize: FIXTURE.averageResponseSize,
        totalRequests: [
          { timestamp: TO_ISO, method: 'GET', value: 11 },
          { timestamp: TO_ISO, method: 'POST', value: 3 },
          { timestamp: TO_ISO, method: 'OPTIONS', value: 3 },
        ],
      },
      responseTimes: {
        max: FIXTURE.durationMax,
        p95: FIXTURE.durationP95,
        p75: FIXTURE.durationP75,
        avg: FIXTURE.averageResponseTime,
      },
      errors: {
        errorRate: FIXTURE.errorRate,
        totalErrors: [
          { timestamp: TO_ISO, method: 'POST', status: '500', value: 142 },
          { timestamp: TO_ISO, method: 'GET', status: '404', value: 38 },
        ],
      },
    };

    expect(result).toEqual(expected);
  });

  it('handles a function with no traffic in the window', () => {
    const empty: GetFunctionsMetricsDashboardQuery = {
      totalInvocations: [],
      totalBytesSent: [],
      totalDuration: [],
      totalErrors: [],
      totalRequestsByMethod: [],
      invocations: [],
      responseStatus: [],
      averageResponseSize: [],
      averageResponseTime: [],
      errorRate: [],
      durationP75: [],
      durationP95: [],
      durationMax: [],
    };

    expect(transformFunctionMetrics(empty, TO)).toEqual({
      summary: {
        totalInvocations: 0,
        totalBytesSent: 0,
        totalDurationSeconds: 0,
      },
      general: {
        invocationsByMethod: [],
        responseStatus: [],
        averageResponseSize: [],
        totalRequests: [],
      },
      responseTimes: {
        max: [],
        p95: [],
        p75: [],
        avg: [],
      },
      errors: {
        errorRate: [],
        totalErrors: [],
      },
    });
  });
});
