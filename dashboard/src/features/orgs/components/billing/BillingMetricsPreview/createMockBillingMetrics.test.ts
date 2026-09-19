import { BILLING_USAGE_REFERENCE_LINES } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import { createMockBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/createMockBillingMetrics';
import type { BillingMetricsProject } from '@/features/orgs/components/billing/BillingMetricsPreview/types';

const NOW = new Date('2026-08-26T13:37:00.000Z');

function makeProjects(count: number): BillingMetricsProject[] {
  return Array.from({ length: count }, (_value, index) => ({
    id: `project-${index}`,
    name: `Project ${index}`,
  }));
}

describe('createMockBillingMetrics', () => {
  it('uses Pro allowance and credit references for the mock charts', () => {
    expect(BILLING_USAGE_REFERENCE_LINES).toEqual({
      egress: { value: 50_000, label: 'Included usage' },
      functions: { value: 36_000, label: 'Included usage' },
      dedicatedCompute: {
        value: 12_500_000,
        label: 'Approx. $15 compute credit',
      },
    });
  });

  it('derives current service charges from the published pricing chart', () => {
    const { monthlyInvoices } = createMockBillingMetrics({
      projects: makeProjects(1),
      now: NOW,
    });
    const currentInvoice = monthlyInvoices[monthlyInvoices.length - 1];

    expect(
      Object.fromEntries(
        currentInvoice.services.map((service) => [
          service.key,
          service.amountMinor,
        ]),
      ),
    ).toEqual({
      plan: 2500,
      dedicatedCompute: 10_000,
      egress: 610,
      functionDuration: 1080,
      deployedFunctions: 1000,
      persistentVolume: 400,
      customDomains: 1000,
      pitr: 10_000,
    });
    expect(currentInvoice.amountDueMinor).toBe(26_590);
  });

  it('models five finalized invoices plus the current upcoming invoice', () => {
    const { monthlyInvoices } = createMockBillingMetrics({
      projects: makeProjects(1),
      now: NOW,
    });

    expect(monthlyInvoices.map((invoice) => invoice.periodStart)).toEqual([
      '2026-03-01T00:00:00.000Z',
      '2026-04-01T00:00:00.000Z',
      '2026-05-01T00:00:00.000Z',
      '2026-06-01T00:00:00.000Z',
      '2026-07-01T00:00:00.000Z',
      '2026-08-01T00:00:00.000Z',
    ]);
    expect(monthlyInvoices.map((invoice) => invoice.status)).toEqual([
      'finalized',
      'finalized',
      'finalized',
      'finalized',
      'finalized',
      'upcoming',
    ]);
  });

  it('keeps service charges and non-service adjustments separate', () => {
    const { monthlyInvoices } = createMockBillingMetrics({
      projects: makeProjects(1),
      now: NOW,
    });

    monthlyInvoices.forEach((invoice) => {
      expect(
        invoice.services.reduce(
          (total, service) => total + service.amountMinor,
          0,
        ),
      ).toBe(invoice.serviceChargesMinor);
      expect(invoice.serviceChargesMinor + invoice.adjustmentsMinor).toBe(
        invoice.amountDueMinor,
      );
      invoice.services.forEach((service) => {
        expect(service.amountMinor).toBeGreaterThan(0);
      });
    });
    expect(
      monthlyInvoices.some((invoice) => invoice.adjustmentsMinor < 0),
    ).toBe(true);
    expect(
      monthlyInvoices.some((invoice) => invoice.adjustmentsMinor > 0),
    ).toBe(true);
  });

  it('creates only supported mock usage categories', () => {
    const { usageReports } = createMockBillingMetrics({
      projects: makeProjects(2),
      now: NOW,
    });

    expect(new Set(usageReports.map((report) => report.type))).toEqual(
      new Set(['egress', 'functions', 'dedicatedCompute']),
    );
  });

  it('provides the retained 60-day report window', () => {
    const { usageReports } = createMockBillingMetrics({
      projects: makeProjects(2),
      now: NOW,
    });

    expect(usageReports).toHaveLength(300);
    const reportEnds = usageReports.map((report) => report.reportEnds).sort();
    expect(reportEnds[0]).toBe('2026-06-28T13:37:00.000Z');
    expect(reportEnds[reportEnds.length - 1]).toBe(NOW.toISOString());

    const projectEgressReports = usageReports.filter(
      (report) => report.projectID === 'project-0' && report.type === 'egress',
    );
    expect(projectEgressReports).toHaveLength(60);
  });

  it('preserves four-hour usage windows and pending mock values', () => {
    const { usageReports } = createMockBillingMetrics({
      projects: makeProjects(2),
      now: NOW,
    });

    usageReports.forEach((report) => {
      const windowMs =
        new Date(report.reportEnds).getTime() -
        new Date(report.reportStarts).getTime();
      expect(windowMs).toBe(4 * 60 * 60 * 1000);
      expect(typeof report.pending).toBe('boolean');
      expect(Number.isInteger(report.value)).toBe(true);
    });

    const currentReports = usageReports.filter(
      (report) => report.reportEnds === NOW.toISOString(),
    );
    expect(currentReports.some((report) => report.pending)).toBe(true);
    expect(currentReports.some((report) => !report.pending)).toBe(true);
    expect(
      usageReports
        .filter((report) => report.reportEnds !== NOW.toISOString())
        .every((report) => !report.pending),
    ).toBe(true);
  });

  it('uses the provided project identities for reports and resources', () => {
    const projects: BillingMetricsProject[] = [
      { id: 'storefront-id', name: 'Storefront' },
      { id: 'analytics-id', name: 'Analytics' },
    ];
    const { usageReports, trackedResources } = createMockBillingMetrics({
      projects,
      now: NOW,
    });

    const reportNames = new Set(
      usageReports.map((report) => report.projectName),
    );
    const resourceNames = new Set(
      trackedResources.map((resource) => resource.projectName),
    );
    expect(reportNames).toEqual(new Set(['Analytics', 'Storefront']));
    expect(resourceNames).toEqual(new Set(['Analytics', 'Storefront']));
  });

  it('models only resource fields already tracked by billing', () => {
    const { trackedResources } = createMockBillingMetrics({
      projects: makeProjects(1),
      now: NOW,
    });

    expect(trackedResources).toEqual([
      {
        projectID: 'project-0',
        projectName: 'Project 0',
        dedicatedComputeMillicores: 1000,
        functionsAmount: 1,
        customDomains: 0,
        persistentVolumeGB: 10,
        pitr: 1,
      },
    ]);
  });

  it('does not generate project data when the organization has no projects', () => {
    const data = createMockBillingMetrics({ projects: [], now: NOW });

    expect(data.usageReports).toEqual([]);
    expect(data.trackedResources).toEqual([]);
  });

  it('contains no unsupported historical charges or project monetary attribution', () => {
    const data = createMockBillingMetrics({
      projects: makeProjects(2),
      now: NOW,
    });

    expect(data).not.toHaveProperty('monthlyServiceSpend');
    expect(data).not.toHaveProperty('currentProjectAttribution');
    expect(data).not.toHaveProperty('costDrivers');
    expect(data).not.toHaveProperty('asOf');
    expect(data).not.toHaveProperty('dataThrough');
  });

  it('is deterministic and independent of project input order', () => {
    const projects = makeProjects(4);

    expect(
      createMockBillingMetrics({ projects: [...projects].reverse(), now: NOW }),
    ).toEqual(createMockBillingMetrics({ projects, now: new Date(NOW) }));
  });
});
