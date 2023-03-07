import { ChangePlanModal } from '@/components/applications/ChangePlanModal';
import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/context/UIContext';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Chip from '@/ui/v2/Chip';
import CogIcon from '@/ui/v2/icons/CogIcon';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import Link from 'next/link';

export default function OverviewTopBar() {
  const isPlatform = useIsPlatform();
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const isPro = !currentApplication?.plan?.isFree;
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
      <div className="grid items-center gap-2 md:grid-flow-col">
        <div className="grid grid-flow-col items-center justify-start gap-2">
          <div className="h-10 w-10 overflow-hidden rounded-lg">
            <Image
              src="/logos/new.svg"
              alt="Nhost Logo"
              width={40}
              height={40}
            />
          </div>

          <Text variant="h2" component="h1">
            {currentApplication.name}
          </Text>
        </div>

        <Box className="grid grid-flow-col items-center justify-start gap-2">
          {isPro ? (
            <Chip
              className="self-center font-medium"
              size="small"
              label="Pro Plan"
              color="primary"
            />
          ) : (
            <>
              <Chip
                className="self-center font-medium"
                size="small"
                label="Free Plan"
                color="default"
                variant="filled"
              />
              <Button
                variant="borderless"
                className="mr-2"
                onClick={() => {
                  openAlertDialog({
                    title: 'Upgrade your plan.',
                    payload: <ChangePlanModal />,
                    props: {
                      PaperProps: { className: 'p-0' },
                      hidePrimaryAction: true,
                      hideSecondaryAction: true,
                      hideTitle: true,
                      maxWidth: 'lg',
                    },
                  });
                }}
              >
                Upgrade
              </Button>
            </>
          )}
        </Box>
      </div>
      <Link
        href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/general`}
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
