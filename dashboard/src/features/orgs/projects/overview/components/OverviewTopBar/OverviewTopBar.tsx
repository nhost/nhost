import { useUI } from '@/components/common/UIProvider';
import { CogIcon } from '@/components/ui/v2/icons/CogIcon';
import { Text } from '@/components/ui/v2/Text';
import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import UpgradeProjectDialog from '@/features/orgs/projects/overview/components/OverviewTopBar/UpgradeProjectDialog';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { org } = useCurrentOrg();
  const { project } = useProject();
  const { maintenanceActive } = useUI();

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

            <Text variant="h2" component="h1">
              local
            </Text>
          </div>
        </div>
      </div>
    );
  }

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
              <Text
                variant="h2"
                component="h1"
                className="grid grid-flow-col items-center gap-3"
              >
                {project.name}
              </Text>
              {project.creator && (
                <Text
                  color="secondary"
                  variant="subtitle2"
                  className="md:hidden"
                >
                  Created by{' '}
                  {project.creator?.displayName || project.creator?.email}{' '}
                  {formatDistanceToNowStrict(parseISO(project.createdAt))} ago
                </Text>
              )}
            </div>

            {project.creator && (
              <Text
                color="secondary"
                variant="subtitle2"
                className="hidden md:block"
              >
                Created by{' '}
                {project.creator?.displayName || project.creator?.email}{' '}
                {formatDistanceToNowStrict(parseISO(project.createdAt))} ago
              </Text>
            )}
          </div>
        </div>
      </div>
      <div className="flex content-center gap-4">
        {isFreeProject && <UpgradeProjectDialog />}
        <Link
          href={`/orgs/${org?.slug}/projects/${project?.subdomain}/settings`}
          passHref
          legacyBehavior
        >
          <Button
            variant="outline"
            className="gap-2"
            color="secondary"
            disabled={maintenanceActive}
          >
            Settings
            <CogIcon className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}
