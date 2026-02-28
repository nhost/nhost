import { NavLink } from '@/components/common/NavLink';
import { useUI } from '@/components/common/UIProvider';
import { Box } from '@/components/ui/v2/Box';
import { GitHubIcon } from '@/components/ui/v2/icons/GitHubIcon';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function OverviewRepository() {
  const { project } = useProject();
  const { org } = useCurrentOrg();
  const { maintenanceActive } = useUI();

  return (
    <div>
      <Text variant="h3">Repository</Text>
      <Text variant="subtitle1" className="!font-medium mt-2">
        {!project?.githubRepository
          ? 'Connect your project with a GitHub repository to create your first deployment.'
          : 'GitHub is connected.'}
      </Text>
      {!project?.githubRepository ? (
        <div className="mt-6 flex flex-row place-content-between rounded-lg">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            variant="outline"
            className="h-9 w-full gap-2"
          >
            <GitHubIcon />
            Connect to GitHub
          </NavLink>
        </div>
      ) : (
        <Box
          className="mt-6 flex flex-row place-content-between rounded-lg p-2"
          sx={{ backgroundColor: 'grey.200' }}
        >
          <Box
            className="ml-2 grid grid-flow-col gap-1.5"
            sx={{ backgroundColor: 'transparent' }}
          >
            <GitHubIcon className="h-4 w-4 self-center" />
            <Text variant="body1" className="self-center font-normal">
              {project?.githubRepository.fullName}
            </Text>
          </Box>

          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/git`}
            className="text-primary"
            variant="ghost"
            underline="none"
            size="sm"
            disabled={maintenanceActive}
          >
            Edit
          </NavLink>
        </Box>
      )}
    </div>
  );
}
