import { useUI } from '@/components/common/UIProvider';
import { Button } from '@/components/ui/v2/Button';
import { Chip } from '@/components/ui/v2/Chip';
import { CogIcon } from '@/components/ui/v2/icons/CogIcon';
import { Text } from '@/components/ui/v2/Text';
import { MigrateProjectToOrg } from '@/features/orgs/components/MigrateProjectToOrg';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const isOwner = useIsCurrentUserOwner();
  const isStarter = currentProject?.legacyPlan?.name === 'Starter';
  const { maintenanceActive } = useUI();

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
              <div className="flex flex-row items-center gap-2">
                <Text
                  variant="h2"
                  component="h1"
                  className="grid grid-flow-col items-center gap-3"
                >
                  {currentProject.name}
                </Text>
                <Chip
                  size="small"
                  className="w-fit"
                  label={currentProject.legacyPlan.name}
                  color={!isStarter ? 'primary' : 'default'}
                />
              </div>
              {currentProject.creator && (
                <Text
                  color="secondary"
                  variant="subtitle2"
                  className="md:hidden"
                >
                  Created by{' '}
                  {currentProject.creator?.displayName ||
                    currentProject.creator?.email}{' '}
                  {formatDistanceToNowStrict(
                    parseISO(currentProject.createdAt),
                  )}{' '}
                  ago
                </Text>
              )}
            </div>

            {currentProject.creator && (
              <Text
                color="secondary"
                variant="subtitle2"
                className="hidden md:block"
              >
                Created by{' '}
                {currentProject.creator?.displayName ||
                  currentProject.creator?.email}{' '}
                {formatDistanceToNowStrict(parseISO(currentProject.createdAt))}{' '}
                ago
              </Text>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {isOwner && <MigrateProjectToOrg />}
        <Link
          href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/general`}
          passHref
          legacyBehavior
        >
          <Button
            endIcon={<CogIcon className="h-4 w-4" />}
            variant="outlined"
            color="secondary"
            className="w-full sm:w-fit"
            disabled={maintenanceActive}
          >
            Settings
          </Button>
        </Link>
      </div>
    </div>
  );
}
