import { SiGithub as GitHubIcon } from '@icons-pack/react-simple-icons';
import { Pencil } from 'lucide-react';
import { NavLink } from '@/components/common/NavLink';
import { dashboardNavItemIconClassName } from '@/components/layout/DashboardSidebar/DashboardSidebar';
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
    <section>
      <h2 className="font-semibold text-lg">Repository</h2>
      {!project?.githubRepository && (
        <p className="mt-2 font-medium text-muted-foreground">
          Connect your project with a GitHub repository to create your first
          deployment.
        </p>
      )}
      {!project?.githubRepository ? (
        <div className="mt-6 flex flex-row place-content-between rounded-lg">
          <NavLink
            href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
            variant="outline-emboss"
            className="h-9 w-full gap-2"
          >
            <GitHubIcon className="h-4 w-4" />
            Connect to GitHub
          </NavLink>
        </div>
      ) : (
        <div className="mt-6 flex flex-row place-content-between rounded-lg border p-3">
          <div className="ml-2 grid grid-flow-col gap-1.5">
            <GitHubIcon className="h-4 w-4 self-center" />
            <span className="self-center font-normal">
              {project?.githubRepository.fullName}
            </span>
          </div>

          <Tooltip>
            <TooltipTrigger asChild>
              <NavLink
                href={`/orgs/${org?.slug}/projects/${project?.subdomain}/deployments/settings`}
                variant="ghost"
                underline="none"
                size="icon"
                aria-label="Edit"
                className="group h-8 w-8 hover:bg-transparent"
              >
                <Pencil
                  className={`h-4 w-4 transition-colors group-hover:text-primary-main ${dashboardNavItemIconClassName}`}
                />
              </NavLink>
            </TooltipTrigger>
            <TooltipContent>Edit</TooltipContent>
          </Tooltip>
        </div>
      )}
    </section>
  );
}
