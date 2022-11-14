import { EditRepositorySettings } from '@/components/applications/github/EditRepositorySettings';
import useGitHubModal from '@/components/applications/github/useGitHubModal';
import { useDialog } from '@/components/common/DialogProvider';
import GithubIcon from '@/components/icons/GithubIcon';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';

export default function OverviewRepository() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openAlertDialog } = useDialog();
  const { openGitHubModal } = useGitHubModal();

  return (
    <div>
      <Text variant="h3" className="lg:!font-bold">
        Repository
      </Text>
      <Text variant="subtitle1" className="mt-2 !font-medium">
        {!currentApplication.githubRepository
          ? 'Connect your project with a GitHub repository to create your first deployment.'
          : 'GitHub is connected.'}
      </Text>
      {!currentApplication.githubRepository ? (
        <div className="mt-6 flex flex-row place-content-between rounded-lg">
          <Button
            variant="outlined"
            color="secondary"
            className="w-full border-1 hover:border-1"
            startIcon={<GithubIcon />}
            onClick={openGitHubModal}
          >
            Connect to GitHub
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-row place-content-between rounded-lg bg-card py-1 px-2">
          <div className="ml-2 flex flex-row">
            <GithubIcon className="mr-1.5 h-4 w-4 self-center text-black" />
            <Text
              variant="body1"
              className="self-center font-normal text-black"
            >
              {currentApplication.githubRepository.fullName}
            </Text>
          </div>
          <Button
            variant="borderless"
            onClick={() => {
              openAlertDialog({
                title: 'Edit Repository Settings',
                payload: (
                  <EditRepositorySettings
                    handleSelectAnotherRepository={openGitHubModal}
                  />
                ),
                props: {
                  hideTitle: true,
                  hidePrimaryAction: true,
                  hideSecondaryAction: true,
                },
              });
            }}
          >
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
