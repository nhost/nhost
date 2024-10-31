import { useDialog } from '@/components/common/DialogProvider';
import { NhostIcon } from '@/components/presentational/NhostIcon';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useState } from 'react';

import Image from 'next/image';
import { type ReactNode } from 'react';

interface UpgradeToProBannerProps {
  title: string;
  description: string | ReactNode;
}

export default function UpgradeToProBanner({
  title,
  description,
}: UpgradeToProBannerProps) {
  const isOwner = useIsCurrentUserOwner();
  const { openAlertDialog } = useDialog();
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);

  return (
    <Box
      sx={{ backgroundColor: 'primary.light' }}
      className="flex flex-col justify-between space-y-4 rounded-md p-4 lg:flex-row lg:items-center lg:space-y-0"
    >
      <div className="flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex flex-col space-y-2 xs:flex-row xs:space-x-2 xs:space-y-0">
            <Text>Available with</Text>
            <div className="flex flex-row space-x-2">
              <NhostIcon />
              <Text sx={{ color: 'primary.main' }} className="font-semibold">
                Nhost Pro & Team
              </Text>
            </div>
          </div>
          <Text variant="h3">{title}</Text>
          {typeof description === 'string' ? (
            <Text>{description}</Text>
          ) : (
            description
          )}
        </div>

        <div className="flex flex-col gap-2 space-y-2 lg:flex-row lg:items-center lg:space-x-2 lg:space-y-0">
          <Button
            className="max-w-xs lg:w-auto"
            onClick={() => {
              if (isOwner) {
                setTransferProjectDialogOpen(true);
              } else {
                openAlertDialog({
                  title: "You can't migrate this project",
                  payload: (
                    <Text variant="subtitle1" component="span">
                      Ask an owner of this organization to migrate the project.
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
            Transfer Project
          </Button>
          <TransferProjectDialog
            open={transferProjectDialogOpen}
            setOpen={setTransferProjectDialogOpen}
          />
          <Link
            href="https://nhost.io/pricing"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
            className="text-center font-medium"
            sx={{
              color: 'text.secondary',
            }}
          >
            See all features
            <ArrowSquareOutIcon className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>

      <Image
        src="/illustration-unbox.png"
        width={300}
        height={140}
        objectFit="contain"
        className=""
        alt="Upgrade to Pro illustration"
      />
    </Box>
  );
}
