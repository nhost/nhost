export const BILLING_SERVICE_KEYS = [
  'plan',
  'dedicatedCompute',
  'egress',
  'functionDuration',
  'deployedFunctions',
  'persistentVolume',
  'customDomains',
  'pitr',
] as const;

export type BillingServiceKey = (typeof BILLING_SERVICE_KEYS)[number];

export interface BillingServiceCharge {
  key: BillingServiceKey;
  amountMinor: number;
}

export interface BillingMonthlyInvoice {
  periodStart: string;
  periodEnd: string;
  status: 'finalized' | 'upcoming';
  serviceChargesMinor: number;
  adjustmentsMinor: number;
  amountDueMinor: number;
  services: BillingServiceCharge[];
}

export const BILLING_USAGE_REPORT_TYPES = [
  'egress',
  'functions',
  'dedicatedCompute',
] as const;

export type BillingUsageReportType =
  (typeof BILLING_USAGE_REPORT_TYPES)[number];

export interface BillingUsageReport {
  id: string;
  projectID: string;
  projectName: string;
  type: BillingUsageReportType;
  value: number;
  reportStarts: string;
  reportEnds: string;
  pending: boolean;
}

export interface BillingTrackedResource {
  projectID: string;
  projectName: string;
  dedicatedComputeMillicores: number;
  functionsAmount: number;
  customDomains: number;
  persistentVolumeGB: number;
  pitr: number;
}

export interface BillingMetricsData {
  source: 'mock';
  currency: string;
  monthlyInvoices: BillingMonthlyInvoice[];
  usageReports: BillingUsageReport[];
  trackedResources: BillingTrackedResource[];
}

export interface BillingMetricsProject {
  id: string;
  name: string;
}
