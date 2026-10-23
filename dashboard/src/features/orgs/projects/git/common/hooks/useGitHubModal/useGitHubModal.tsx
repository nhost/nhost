import { useDialog } from '@/components/common/DialogProvider';
import { ConnectGitHubModal } from '@/features/orgs/projects/git/common/components/ConnectGitHubModal';

export default function useGitHubModal() {
  const { openDialog, closeDialog } = useDialog();

  function openGitHubModal() {
    openDialog({
      title: 'Connect GitHub Repository',
      component: <ConnectGitHubModal close={closeDialog} />,
      props: {
        hideTitle: true,
        PaperProps: { className: 'max-w-2xl' },
      },
    });
  }

  return { openGitHubModal };
}
