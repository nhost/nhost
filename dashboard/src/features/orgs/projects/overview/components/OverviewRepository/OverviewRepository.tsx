import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import Link from 'next/link';
import { Button } from '@/components/ui/v3/button';
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
          <Button asChild variant="outline" className="w-full gap-2">
            <Link
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
            >
              <GitHubIcon className="h-4 w-4" />
              Connect to GitHub
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 flex flex-row place-content-between rounded-lg bg-muted p-2">
          <div className="ml-2 grid grid-flow-col gap-1.5">
            <GitHubIcon className="h-4 w-4 self-center" />
            <span className="self-center font-normal">
              {project?.githubRepository.fullName}
            </span>
          </div>

          <Button asChild variant="ghost" className="text-primary">
            <Link
              href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
            >
              Edit
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
