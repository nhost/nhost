import ConnectGithubModal from '@/components/applications/ConnectGithubModal';
import { useDialog } from '@/components/common/DialogProvider';

function useGitHubModal() {
  const { openAlertDialog } = useDialog();

  function openGitHubModal() {
    openAlertDialog({
      title: 'Connect GitHub Repository',
      payload: <ConnectGithubModal />,
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

export default useGitHubModal;
