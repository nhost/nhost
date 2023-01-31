import GithubIcon from '@/components/icons/GithubIcon';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import NavLink from 'next/link';

export default function OverviewRepository() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  return (
    <div>
      <Text variant="h3">Repository</Text>
      <Text variant="subtitle1" className="mt-2 !font-medium">
        {!currentApplication.githubRepository
          ? 'Connect your project with a GitHub repository to create your first deployment.'
          : 'GitHub is connected.'}
      </Text>
      {!currentApplication.githubRepository ? (
        <div className="mt-6 flex flex-row place-content-between rounded-lg">
          <NavLink
            href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/git`}
            passHref
          >
            <Button
              variant="outlined"
              color="secondary"
              className="w-full border-1 hover:border-1"
              startIcon={<GithubIcon />}
            >
              Connect to GitHub
            </Button>
          </NavLink>
        </div>
      ) : (
        <Box
          className="mt-6 flex flex-row place-content-between rounded-lg p-2"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Box
            className="grid grid-flow-col gap-1.5 ml-2"
            sx={{ backgroundColor: 'transparent' }}
          >
            <GithubIcon className="h-4 w-4 self-center" />
            <Text variant="body1" className="self-center font-normal">
              {currentApplication.githubRepository.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/git`}
            passHref
          >
            <Button variant="borderless" size="small">
              Edit
            </Button>
          </NavLink>
        </Box>
      )}
    </div>
  );
}
