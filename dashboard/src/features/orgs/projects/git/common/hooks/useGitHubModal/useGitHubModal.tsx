import { useDialog } from '@/components/common/DialogProvider';
import { ConnectGitHubModal } from '@/features/orgs/projects/git/common/components/ConnectGitHubModal';

export default function useGitHubModal() {
  const { openAlertDialog, closeAlertDialog } = useDialog();

  function openGitHubModal() {
    openAlertDialog({
      title: 'Connect GitHub Repository',
      payload: <ConnectGitHubModal close={closeAlertDialog} />,
      props: {
        hidePrimaryAction: true,
        hideSecondaryAction: true,
        hideTitle: true,
        maxWidth: 'md',
      },
    });
  }

  return { openGitHubModal };
}
