import { useUI } from '@/components/common/UIProvider';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import NavLink from 'next/link';

export default function OverviewRepository() {
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const { maintenanceActive } = useUI();

  return (
    <div>
      <Text variant="h3">Repository</Text>
      <Text variant="subtitle1" className="mt-2 !font-medium">
        {!project?.githubRepository
          ? 'Connect your project with a GitHub repository to create your first deployment.'
          : 'GitHub is connected.'}
      </Text>
      {!project?.githubRepository ? (
        <div className="flex flex-row mt-6 rounded-lg place-content-between">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            passHref
            legacyBehavior
          >
            <Button
              variant="outlined"
              color="secondary"
              className="w-full border-1 hover:border-1"
              startIcon={<GitHubIcon />}
              disabled={maintenanceActive}
            >
              Connect to GitHub
            </Button>
          </NavLink>
        </div>
      ) : (
        <Box
          className="flex flex-row p-2 mt-6 rounded-lg place-content-between"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Box
            className="ml-2 grid grid-flow-col gap-1.5"
            sx={{ backgroundColor: 'transparent' }}
          >
            <GitHubIcon className="self-center w-4 h-4" />
            <Text variant="body1" className="self-center font-normal">
              {project?.githubRepository.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            passHref
            legacyBehavior
          >
            <Button
              variant="borderless"
              size="small"
              disabled={maintenanceActive}
            >
              Edit
            </Button>
          </NavLink>
        </Box>
      )}
    </div>
  );
}
