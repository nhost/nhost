import { useNavigate } from '@tanstack/react-router';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';

function UpgradeProjectDialog() {
  const navigate = useNavigate();

  function handleClick() {
    navigate({
      from: '/orgs/$orgSlug',
      to: '/orgs/$orgSlug/billing',
      params: true,
    });
  }

  return (
    <OpenTransferDialogButton
      buttonText="Upgrade to Pro"
      onClick={handleClick}
    />
  );
}

export default UpgradeProjectDialog;
