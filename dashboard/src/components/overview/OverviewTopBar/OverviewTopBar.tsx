import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/context/UIContext';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import CogIcon from '@/ui/v2/icons/CogIcon';
import Text from '@/ui/v2/Text';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import Image from 'next/image';
import Link from 'next/link';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentProject } = useCurrentWorkspaceAndProject();
  const isPro = !currentProject?.plan.isFree;
  const { openAlertDialog } = useDialog();
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
              <Text
                variant="h2"
                component="h1"
                className="grid grid-flow-col items-center gap-3"
              >
                {currentProject.name}
              </Text>

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

              <div className="mt-1 inline-grid grid-flow-col items-center justify-start gap-2 md:mt-0">
                <Chip
                  size="small"
                  label={isPro ? 'Pro' : 'Starter'}
                  color={isPro ? 'primary' : 'default'}
                />

                <Button
                  variant="borderless"
                  className="mr-2"
                  onClick={() => {
                    openAlertDialog({
                      title: 'Upgrade your plan.',
                      payload: <ChangePlanModal />,
                      props: {
                        PaperProps: { className: 'p-0 max-w-xl w-full' },
                        hidePrimaryAction: true,
                        hideSecondaryAction: true,
                        hideTitle: true,
                      },
                    });
                  }}
                >
                  Upgrade
                </Button>
              </div>
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

      <Link
        href={`/${currentWorkspace.slug}/${currentProject.slug}/settings/general`}
        passHref
      >
        <Button
          endIcon={<CogIcon className="h-4 w-4" />}
          variant="outlined"
          color="secondary"
          disabled={maintenanceActive}
        >
          Settings
        </Button>
      </Link>
    </div>
  );
}
