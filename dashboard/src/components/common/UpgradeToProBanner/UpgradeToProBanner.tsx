import { useDialog } from '@/components/common/DialogProvider';
import { NhostIcon } from '@/components/presentational/NhostIcon';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { ChangePlanModal } from '@/features/projects/common/components/ChangePlanModal';
import { useIsCurrentUserOwner } from '@/features/projects/common/hooks/useIsCurrentUserOwner';

import Image from 'next/image';

interface UpgradeToProBannerProps {
  title: string;
  description: string;
}

export default function UpgradeToProBanner({
  title,
  description,
}: UpgradeToProBannerProps) {
  const { openDialog, openAlertDialog } = useDialog();
  const isOwner = useIsCurrentUserOwner();

  return (
    <Box
      sx={{ backgroundColor: 'primary.light' }}
      className="flex flex-col p-4 space-y-4 rounded-md lg:flex-row lg:items-center lg:space-y-0"
    >
      <div className="flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex flex-col space-y-2 xs:flex-row xs:space-y-0 xs:space-x-2">
            <Text>Available with</Text>
            <div className="flex flex-row space-x-2">
              <NhostIcon />
              <Text sx={{ color: 'primary.main' }} className="font-semibold">
                Nhost Pro
              </Text>
            </div>
          </div>
          <Text variant="h3">{title}</Text>
          <Text>{description}</Text>
        </div>

        <div className="flex flex-col space-y-2 lg:flex-row lg:items-center lg:space-y-0 lg:space-x-2">
          <Button
            className="rounded-md"
            onClick={() => {
              if (isOwner) {
                openDialog({
                  component: <ChangePlanModal />,
                  props: {
                    PaperProps: { className: 'p-0 max-w-xl w-full' },
                  },
                });
              } else {
                openAlertDialog({
                  title: "You can't upgrade this project",
                  payload: (
                    <Text variant="subtitle1" component="span">
                      Ask an owner of this workspace to upgrade the project.
                    </Text>
                  ),
                  props: {
                    secondaryButtonText: 'I understand',
                    hidePrimaryAction: true,
                  },
                });
              }
            }}
          >
            Upgrade to Pro
          </Button>
          <Link
            href="https://nhost.io/pricing"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className="font-medium text-center"
            sx={{
              color: 'text.secondary',
            }}
          >
            See all features
            <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      <div className="max-w-xs mx-auto">
        <Image
          src="/illustration-unbox.png"
          width={400}
          height={260}
          objectFit="contain"
        />
      </div>
    </Box>
  );
}
