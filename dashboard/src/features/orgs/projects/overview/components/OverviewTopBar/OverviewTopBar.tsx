import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Settings as CogIcon } from 'lucide-react';
import Image from 'next/image';
import { NavLink } from '@/components/common/NavLink';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import UpgradeToProButton from '@/features/orgs/projects/overview/components/OverviewTopBar/UpgradeToProButton';
import { isNotEmptyValue } from '@/lib/utils';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project } = useProject();

  const isFreeProject = !!org?.plan.isFree;

  if (!isPlatform) {
    return (
      <div className="flex flex-row place-content-between items-center py-5">
        <div className="flex flex-row items-center space-x-2">
          <div className="grid grid-flow-col gap-2">
            <div className="h-10 w-10 overflow-hidden rounded-lg">
              <Image
                src="/logos/new.svg"
                alt="Nhost Logo"
                width={40}
                height={40}
              />
            </div>

            <h1 className="font-semibold text-2xl">local</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!isNotEmptyValue(project)) {
    return null;
  }

  const creatorName = project.creator?.displayName || project.creator?.email;
  const createdBy = project.creator
    ? `Created by ${creatorName} ${formatDistanceToNowStrict(
        parseISO(project.createdAt),
      )} ago`
    : null;

  return (
    <div className="grid items-center gap-4 pb-5 md:grid-flow-col md:place-content-between md:py-5">
      <div className="grid items-center gap-4 md:grid-flow-col">
        <div className="grid grid-flow-col items-center justify-start gap-2">
          <div className="h-10 w-10 overflow-hidden rounded-lg">
            <Image
              src="/logos/new.svg"
              alt="Nhost Logo"
              width={56}
              height={56}
            />
          </div>
          <div className="grid grid-flow-row">
            <div className="grid grid-flow-row items-center justify-start md:grid-flow-col md:gap-3">
              <h1 className="grid grid-flow-col items-center gap-3 font-semibold text-2xl">
                {project.name}
              </h1>
              {createdBy && (
                <p className="text-muted-foreground text-sm md:hidden">
                  {createdBy}
                </p>
              )}
            </div>

            {createdBy && (
              <p className="hidden text-muted-foreground text-sm md:block">
                {createdBy}
              </p>
            )}
          </div>
        </div>
      </div>
      <div className="flex content-center gap-4">
        {isFreeProject && <UpgradeToProButton />}
        <NavLink
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings`}
          className="flex h-10 gap-2"
          variant="outline"
        >
          Settings
          <CogIcon className="h-4 w-4" />
        </NavLink>
      </div>
    </div>
  );
}
