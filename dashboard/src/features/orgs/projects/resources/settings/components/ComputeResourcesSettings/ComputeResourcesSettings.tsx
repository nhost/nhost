import { CogIcon } from 'lucide-react';
import { UpgradeBanner } from '@/components/common/UpgradeBanner';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';

export default function ComputeResourcesSettings() {
  const { org } = useCurrentOrg();

  if (org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeBanner section="settings-compute-resources" icon={CogIcon} />
      </div>
    );
  }

  return <ResourcesForm />;
}
