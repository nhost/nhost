import { colorForProject } from '@/features/orgs/components/billing/BillingUsage/utils/colorForProject';
import { shortenProjectID } from '@/features/orgs/components/billing/BillingUsage/utils/shortenProjectID';
import type { SeriesAccessors } from '@/features/orgs/projects/common/metrics/types';

export const BILLING_USAGE_SERIES_ACCESSORS: SeriesAccessors = {
  keyFor: (labels) => `project-${labels.projectID}`,
  labelFor: (key, labels) =>
    labels.projectKind === 'deleted'
      ? `Deleted · ${shortenProjectID(labels.projectID)}`
      : (labels.projectName ?? key),
  colorFor: (_key, labels) => colorForProject(labels),
};
