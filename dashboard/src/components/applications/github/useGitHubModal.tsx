// ConnectGitHubModal and EditRepositorySettings form a dependency cycle which
// needs to be fixed
// eslint-disable-next-line import/no-cycle
import ConnectGithubModal from '@/components/applications/ConnectGithubModal';
import { useDialog } from '@/components/common/DialogProvider';

/**
 * @deprecated Redirect users to /[workspaceSlug]/[applicationSlug]/settings/git instead.
 */
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
