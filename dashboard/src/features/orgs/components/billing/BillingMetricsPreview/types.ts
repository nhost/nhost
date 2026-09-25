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

export interface BillingMetricsProject {
  id: string;
  name: string;
}
