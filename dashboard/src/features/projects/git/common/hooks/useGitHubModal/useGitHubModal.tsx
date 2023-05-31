import { useDialog } from '@/components/common/DialogProvider';
import { ConnectGitHubModal } from '@/features/projects/git/common/components/ConnectGitHubModal';

export default function useGitHubModal() {
  const { openAlertDialog } = useDialog();

  function openGitHubModal() {
    openAlertDialog({
      title: 'Connect GitHub Repository',
      payload: <ConnectGitHubModal />,
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
