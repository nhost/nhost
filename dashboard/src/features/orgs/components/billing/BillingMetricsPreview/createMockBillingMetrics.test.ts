import { BILLING_USAGE_REFERENCE_LINES } from '@/features/orgs/components/billing/BillingMetricsPreview/constants';
import { createMockBillingMetrics } from '@/features/orgs/components/billing/BillingMetricsPreview/createMockBillingMetrics';
import type { BillingMetricsProject } from '@/features/orgs/components/billing/BillingMetricsPreview/types';

const NOW = new Date('2026-08-26T13:37:00.000Z');

const TEST_APP_IDS = [
  '9e1b7c7a-5c45-44fc-85bc-7a29f29e8f96',
  'a486b088-50e8-41d0-88b0-5bf9a3e7b5e7',
  'c7fbf7ad-b60c-432b-86c2-5a9509054c47',
  'cd2b77ac-3ef1-4a76-819b-ff1caca09213',
];

function makeProjects(count: number): BillingMetricsProject[] {
  return TEST_APP_IDS.slice(0, count).map((id, index) => ({
    id,
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
      (report) =>
        report.projectID === TEST_APP_IDS[0] && report.type === 'egress',
    );
    expect(projectEgressReports).toHaveLength(60);
  });

  it('reports integer usage values like the billing service', () => {
    const { usageReports } = createMockBillingMetrics({
      projects: makeProjects(2),
      now: NOW,
    });

    usageReports.forEach((report) => {
      expect(Number.isInteger(report.value)).toBe(true);
    });
  });

  it('uses the provided project identities for reports and resources', () => {
    const projects: BillingMetricsProject[] = [
      { id: TEST_APP_IDS[2], name: 'Storefront' },
      { id: TEST_APP_IDS[1], name: 'Analytics' },
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
        projectID: TEST_APP_IDS[0],
        projectName: 'Project 0',
        isDeleted: false,
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

    expect(data).not.toHaveProperty('monthlyInvoices');
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
