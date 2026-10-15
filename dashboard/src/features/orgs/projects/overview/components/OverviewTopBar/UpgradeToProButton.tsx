import { useNavigate } from '@tanstack/react-router';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';

function UpgradeToProButton() {
  const navigate = useNavigate();

  function handleClick() {
    navigate({
      from: '/orgs/$orgSlug',
      to: '/orgs/$orgSlug/billing',
      params: true,
      search: { openUpgradeModal: 'true' },
    });
  }

  return (
    <OpenTransferDialogButton
      buttonText="Upgrade to Pro"
      onClick={handleClick}
    />
  );
}

export default UpgradeToProButton;
