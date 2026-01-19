import { useRouter } from 'next/router';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

function UpgradeToProButton() {
  const router = useRouter();
  const { org } = useCurrentOrg();

  function handleClick() {
    router.push(`/orgs/${org?.slug}/billing?openUpgradeModal=true`);
  }

  return (
    <OpenTransferDialogButton
      buttonText="Upgrade to Pro"
      onClick={handleClick}
    />
  );
}

export default UpgradeToProButton;
