import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';

export default function ComputeResourcesSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-compute-resources"
          title="To unlock Compute Resources, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  return <ResourcesForm />;
}
