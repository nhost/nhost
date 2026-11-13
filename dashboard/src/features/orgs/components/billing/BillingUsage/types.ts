export interface BillingCycle {
  start: string;
  end: string;
}

export const BILLING_USAGE_REPORT_TYPES = [
  'egress',
  'functions',
  'dedicatedCompute',
] as const;

export type BillingUsageReportType =
  (typeof BILLING_USAGE_REPORT_TYPES)[number];

export interface BillingUsageReport {
  projectID: string;
  projectName: string;
  isDeleted: boolean;
  type: BillingUsageReportType;
  value: number;
  reportEnds: string;
}

export interface BillingTrackedResource {
  projectID: string;
  projectName: string;
  isDeleted: boolean;
  dedicatedComputeMillicores: number;
  functionsAmount: number;
  customDomains: number;
  persistentVolumeGB: number;
  pitr: number;
}

export interface BillingMetricsData {
  currentCycle: BillingCycle;
  usageReports: BillingUsageReport[];
  trackedResources: BillingTrackedResource[];
}

export const BILLING_USAGE_RANGE_PRESETS = [
  'currentBillingCycle',
  'previousBillingCycle',
  '7d',
  '30d',
  '60d',
] as const;

export type BillingUsageRangePreset =
  (typeof BILLING_USAGE_RANGE_PRESETS)[number];

export type BillingUsageTimeRange =
  | { kind: 'preset'; preset: BillingUsageRangePreset }
  | { kind: 'absolute'; from: string; to: string };

export type BillingUsageTimeZone = 'browser' | 'utc';

export const BILLING_USAGE_CHART_VIEWS = ['cumulative', 'daily'] as const;

export type BillingUsageChartView = (typeof BILLING_USAGE_CHART_VIEWS)[number];

export interface BillingUsageRangeBounds {
  min: string;
  max: string;
  currentBillingCycle: BillingCycle;
}

export interface ResolvedBillingUsageTimeRange {
  from: Date;
  to: Date;
}

export interface BillingUsageBucket {
  day: number;
  start: number;
  end: number;
  cycleStart: number;
  timestamp: number;
}

export interface BillingUsageTimeAxis {
  domain: [number, number];
  ticks: number[];
}

export type BillingUsageProjectKind = 'active' | 'deleted' | 'deletedGroup';

export interface BillingUsagePeriod {
  periodStart: string;
  periodEnd: string;
}

export interface BillingUsageSummary {
  total: number;
  deletedProjects?: {
    count: number;
    total: number;
    percentage: number;
  };
}
