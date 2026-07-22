import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { NhostIcon } from '@/components/presentational/NhostIcon';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { TextLink } from '@/components/ui/v3/text-link';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useTrackEvent } from '@/hooks/useTrackEvent';

interface UpgradeToProBannerProps {
  title: string;
  description: string | ReactNode;
  // Analytics grouping key: use a route-area slug (for example, settings-ai).
  section: string;
}

export default function UpgradeToProBanner({
  title,
  description,
  section,
}: UpgradeToProBannerProps) {
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);
  const track = useTrackEvent();

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per impression, not per re-render
  useEffect(() => {
    track('Upgrade Prompt Viewed', { section });
  }, []);

  const handleTransferDialogOpen = () => setTransferProjectDialogOpen(true);

  return (
    <Box
      sx={{ backgroundColor: 'primary.light' }}
      className="flex flex-col justify-between space-y-4 rounded-md p-4 lg:flex-row lg:items-center lg:space-y-0"
    >
      <div className="flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex xs:flex-row flex-col xs:space-x-2 space-y-2 xs:space-y-0">
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
          <OpenTransferDialogButton
            onClick={handleTransferDialogOpen}
            onInteract={({ isOwner }) =>
              track('Upgrade Prompt Clicked', {
                section,
                cta: 'transfer',
                is_owner: isOwner,
              })
            }
          />
          <TransferProjectDialog
            open={transferProjectDialogOpen}
            setOpen={setTransferProjectDialogOpen}
          />
          <TextLink
            href="https://nhost.io/pricing"
            external
            className="justify-center font-medium text-muted-foreground"
            onClick={() =>
              track('Upgrade Prompt Clicked', {
                section,
                cta: 'see_all_features',
              })
            }
          >
            See all features
          </TextLink>
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
