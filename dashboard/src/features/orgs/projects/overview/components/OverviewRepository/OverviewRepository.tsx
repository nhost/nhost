import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { PencilIcon } from 'lucide-react';
import Link from 'next/link';
import { NavLink } from '@/components/common/NavLink';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function OverviewRepository() {
  const { project } = useProject();
  const { org } = useCurrentOrg();

  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg">Repository</h2>
      {!project?.githubRepository && (
        <p className="text-muted-foreground text-sm">
          Connect your project with a GitHub repository to create your first
          deployment.
        </p>
      )}
      {!project?.githubRepository ? (
        <div className="flex flex-row place-content-between rounded-lg">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
            variant="outline"
            className="h-9 w-full gap-2"
          >
            <GitHubIcon className="h-4 w-4" />
            Connect to GitHub
          </NavLink>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-4 shadow-sm">
          <GitHubIcon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate text-sm">
            {project?.githubRepository.fullName}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="subtle" asChild>
                <Link
                  href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
                  aria-label="Edit repository"
                >
                  <PencilIcon />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        </div>
      )}
    </section>
  );
}
