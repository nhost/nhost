import { BILLING_USAGE_HISTORY_DAYS } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import {
  BILLING_SERVICE_KEYS,
  BILLING_USAGE_REPORT_TYPES,
  type BillingMetricsData,
  type BillingMetricsProject,
  type BillingMonthlyInvoice,
  type BillingServiceCharge,
  type BillingServiceKey,
  type BillingTrackedResource,
  type BillingUsageReport,
  type BillingUsageReportType,
} from '@/features/orgs/components/billing/BillingMetricsPreview/types';

const CURRENCY = 'USD';
const REPORT_WINDOW_HOURS = 4;

const PUBLIC_CLOUD_PRICES_MINOR = {
  proPlanMonth: 2500,
  dedicatedComputeVcpuMonth: 5000,
  egressOverageGB: 10,
  functionExecutionOverageGBHour: 18,
  deployedFunctionsBundle: 500,
  persistentVolumeOverageGB: 20,
  customDomainProjectMonth: 1000,
  pitrProjectMonth: 10_000,
} as const;

interface MonthlyPricingUsageProfile {
  dedicatedComputeVcpuMonths: number;
  egressOverageGB: number;
  functionExecutionOverageGBHours: number;
  deployedFunctionBundles: number;
  persistentVolumeOverageGB: number;
  customDomainProjects: number;
  pitrProjects: number;
}

const MONTHLY_PRICING_USAGE_PROFILES: readonly MonthlyPricingUsageProfile[] = [
  {
    dedicatedComputeVcpuMonths: 1,
    egressOverageGB: 51,
    functionExecutionOverageGBHours: 5,
    deployedFunctionBundles: 0,
    persistentVolumeOverageGB: 5,
    customDomainProjects: 0,
    pitrProjects: 0,
  },
  {
    dedicatedComputeVcpuMonths: 1.5,
    egressOverageGB: 62,
    functionExecutionOverageGBHours: 10,
    deployedFunctionBundles: 1,
    persistentVolumeOverageGB: 10,
    customDomainProjects: 1,
    pitrProjects: 0,
  },
  {
    dedicatedComputeVcpuMonths: 2,
    egressOverageGB: 71,
    functionExecutionOverageGBHours: 20,
    deployedFunctionBundles: 1,
    persistentVolumeOverageGB: 15,
    customDomainProjects: 1,
    pitrProjects: 1,
  },
  {
    dedicatedComputeVcpuMonths: 2,
    egressOverageGB: 83,
    functionExecutionOverageGBHours: 30,
    deployedFunctionBundles: 2,
    persistentVolumeOverageGB: 15,
    customDomainProjects: 1,
    pitrProjects: 1,
  },
  {
    dedicatedComputeVcpuMonths: 2.5,
    egressOverageGB: 91,
    functionExecutionOverageGBHours: 45,
    deployedFunctionBundles: 2,
    persistentVolumeOverageGB: 20,
    customDomainProjects: 1,
    pitrProjects: 1,
  },
  {
    dedicatedComputeVcpuMonths: 2,
    egressOverageGB: 61,
    functionExecutionOverageGBHours: 60,
    deployedFunctionBundles: 2,
    persistentVolumeOverageGB: 20,
    customDomainProjects: 1,
    pitrProjects: 1,
  },
];

const MONTHLY_ADJUSTMENT_PROFILES: readonly number[] = [
  0, -250, 0, 500, -500, 0,
];

export interface CreateMockBillingMetricsOptions {
  projects: BillingMetricsProject[];
  now: Date;
}

export function createMockBillingMetrics({
  projects,
  now,
}: CreateMockBillingMetricsOptions): BillingMetricsData {
  const rankedProjects = [...projects].sort((a, b) => a.id.localeCompare(b.id));
  const monthlyInvoices = createMonthlyInvoices(now);

  return {
    source: 'mock',
    currency: CURRENCY,
    monthlyInvoices,
    usageReports: rankedProjects.flatMap((project, index) =>
      createUsageReports(project, index, now),
    ),
    trackedResources: rankedProjects.map((project, index) =>
      createTrackedResource(project, index),
    ),
  };
}

function createMonthlyInvoices(now: Date): BillingMonthlyInvoice[] {
  return MONTHLY_PRICING_USAGE_PROFILES.map((profile, index) => {
    const monthOffset = index - (MONTHLY_PRICING_USAGE_PROFILES.length - 1);
    const periodStart = startOfUtcMonth(now, monthOffset);
    const periodEnd = startOfUtcMonth(now, monthOffset + 1);
    const services = toServiceCharges(profile);
    const serviceChargesMinor = services.reduce(
      (total, service) => total + service.amountMinor,
      0,
    );
    const adjustmentsMinor = MONTHLY_ADJUSTMENT_PROFILES[index];

    return {
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      status:
        index === MONTHLY_PRICING_USAGE_PROFILES.length - 1
          ? 'upcoming'
          : 'finalized',
      serviceChargesMinor,
      adjustmentsMinor,
      amountDueMinor: serviceChargesMinor + adjustmentsMinor,
      services,
    };
  });
}

function toServiceCharges(
  profile: MonthlyPricingUsageProfile,
): BillingServiceCharge[] {
  const amounts: Record<BillingServiceKey, number> = {
    plan: PUBLIC_CLOUD_PRICES_MINOR.proPlanMonth,
    dedicatedCompute: priceQuantity(
      profile.dedicatedComputeVcpuMonths,
      PUBLIC_CLOUD_PRICES_MINOR.dedicatedComputeVcpuMonth,
    ),
    egress: priceQuantity(
      profile.egressOverageGB,
      PUBLIC_CLOUD_PRICES_MINOR.egressOverageGB,
    ),
    functionDuration: priceQuantity(
      profile.functionExecutionOverageGBHours,
      PUBLIC_CLOUD_PRICES_MINOR.functionExecutionOverageGBHour,
    ),
    deployedFunctions: priceQuantity(
      profile.deployedFunctionBundles,
      PUBLIC_CLOUD_PRICES_MINOR.deployedFunctionsBundle,
    ),
    persistentVolume: priceQuantity(
      profile.persistentVolumeOverageGB,
      PUBLIC_CLOUD_PRICES_MINOR.persistentVolumeOverageGB,
    ),
    customDomains: priceQuantity(
      profile.customDomainProjects,
      PUBLIC_CLOUD_PRICES_MINOR.customDomainProjectMonth,
    ),
    pitr: priceQuantity(
      profile.pitrProjects,
      PUBLIC_CLOUD_PRICES_MINOR.pitrProjectMonth,
    ),
  };

  return BILLING_SERVICE_KEYS.map((key) => ({
    key,
    amountMinor: amounts[key],
  })).filter((service) => service.amountMinor > 0);
}

function priceQuantity(quantity: number, unitPriceMinor: number): number {
  return Math.round(quantity * unitPriceMinor);
}

function createUsageReports(
  project: BillingMetricsProject,
  index: number,
  now: Date,
): BillingUsageReport[] {
  return Array.from({ length: BILLING_USAGE_HISTORY_DAYS }, (_value, day) => {
    const daysAgo = BILLING_USAGE_HISTORY_DAYS - day - 1;
    const reportEnds = addUtcDays(now, -daysAgo);
    const reportStarts = addUtcHours(reportEnds, -REPORT_WINDOW_HOURS);

    return BILLING_USAGE_REPORT_TYPES.flatMap((type) => {
      const value = reportValue(type, index, day);
      if (value === 0) {
        return [];
      }

      return [
        {
          id: `mock-${project.id}-${type}-${reportEnds.toISOString()}`,
          projectID: project.id,
          projectName: project.name,
          type,
          value,
          reportStarts: reportStarts.toISOString(),
          reportEnds: reportEnds.toISOString(),
          pending: daysAgo === 0 && index % 2 === 0,
        },
      ];
    });
  }).flat();
}

function reportValue(
  type: BillingUsageReportType,
  index: number,
  sample: number,
): number {
  switch (type) {
    case 'egress':
      return 1600 + index * 450 + (sample % 7) * 60;
    case 'functions':
      return 1800 + index * 300 + (sample % 5) * 120;
    case 'dedicatedCompute':
      return index % 2 === 0
        ? 240_000 + index * 60_000 + (sample % 6) * 15_000
        : 0;
    default: {
      const unsupportedType: never = type;
      return unsupportedType;
    }
  }
}

function createTrackedResource(
  project: BillingMetricsProject,
  index: number,
): BillingTrackedResource {
  return {
    projectID: project.id,
    projectName: project.name,
    dedicatedComputeMillicores: index % 2 === 0 ? 1000 + index * 500 : 0,
    functionsAmount: index + 1,
    customDomains: index % 2,
    persistentVolumeGB: 10 + index * 5,
    pitr: index % 3 === 0 ? 1 : 0,
  };
}

function startOfUtcMonth(reference: Date, monthOffset: number): Date {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + monthOffset,
      1,
    ),
  );
}

function addUtcHours(reference: Date, hours: number): Date {
  return new Date(reference.getTime() + hours * 60 * 60 * 1000);
}

function addUtcDays(reference: Date, days: number): Date {
  return addUtcHours(reference, days * 24);
}
