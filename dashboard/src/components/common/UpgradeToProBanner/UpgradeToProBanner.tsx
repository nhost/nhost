import Image from 'next/image';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { NhostIcon } from '@/components/presentational/NhostIcon';
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
    <div className="flex flex-col justify-between space-y-4 rounded-md bg-primary-light p-4 text-foreground lg:flex-row lg:items-center lg:space-y-0 dark:bg-[#1b2534]">
      <div className="flex flex-col justify-between space-y-4">
        <div className="space-y-2">
          <div className="flex xs:flex-row flex-col xs:space-x-2 space-y-2 xs:space-y-0">
            <p className="text-sm">Available with</p>
            <div className="flex flex-row space-x-2">
              <NhostIcon />
              <p className="font-semibold text-primary-main text-sm">
                Nhost Pro & Team
              </p>
            </div>
          </div>
          <h3 className="font-medium text-lg">{title}</h3>
          {typeof description === 'string' ? (
            <p className="text-sm">{description}</p>
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
    </div>
  );
}
