import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';

export interface OrganizationLabelProps {
  organization: Org;
}

/** Name and plan badge of an organization, as shown in the header triggers. */
export default function OrganizationLabel({
  organization,
}: OrganizationLabelProps) {
  return (
    <div className="flex min-w-0 flex-1 items-center">
      <span className="truncate" title={organization.name}>
        {organization.name}
      </span>
      <OrganizationPlanBadge plan={organization.plan?.name} />
    </div>
  );
}
