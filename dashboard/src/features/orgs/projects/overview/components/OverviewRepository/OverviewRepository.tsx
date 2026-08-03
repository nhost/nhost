import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { NavLink } from '@/components/common/NavLink';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function OverviewRepository() {
  const { project } = useProject();
  const { org } = useCurrentOrg();

  return (
    <section>
      <h2 className="font-semibold text-lg">Repository</h2>
      <p className="mt-2 font-medium text-muted-foreground">
        {!project?.githubRepository
          ? 'Connect your project with a GitHub repository to create your first deployment.'
          : 'GitHub is connected.'}
      </p>
      {!project?.githubRepository ? (
        <div className="mt-6 flex flex-row place-content-between rounded-lg">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/deployments`}
            variant="outline"
            className="h-9 w-full gap-2"
          >
            <GitHubIcon className="h-4 w-4" />
            Connect to GitHub
          </NavLink>
        </div>
      ) : (
        <div className="mt-6 flex flex-row place-content-between rounded-lg bg-muted p-2">
          <div className="ml-2 grid grid-flow-col gap-1.5">
            <GitHubIcon className="h-4 w-4 self-center" />
            <span className="self-center font-normal">
              {project?.githubRepository.fullName}
            </span>
          </div>

          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings/deployments`}
            className="text-primary"
            variant="ghost"
            underline="none"
            size="sm"
          >
            Edit
          </NavLink>
        </div>
      )}
    </section>
  );
}
