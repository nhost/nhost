import type { BillingUsageReport } from '@/features/orgs/components/billing/BillingUsage/types';

type BillingProjectOrder = Pick<
  BillingUsageReport,
  'projectName' | 'isDeleted'
>;

// Active projects first, then deleted ones, each by name.
export default function compareBillingProjects(
  projectA: BillingProjectOrder,
  projectB: BillingProjectOrder,
): number {
  if (projectA.isDeleted !== projectB.isDeleted) {
    return projectA.isDeleted ? 1 : -1;
  }
  return projectA.projectName.localeCompare(projectB.projectName);
}
