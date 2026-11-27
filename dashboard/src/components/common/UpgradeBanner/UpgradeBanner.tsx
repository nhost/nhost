import Link from 'next/link';
import { type ComponentType, useEffect, useState } from 'react';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { useUpgradePlanLink } from '@/components/layout/AccountMenu/useUpgradePlanLink';
import { Button } from '@/components/ui/v3/button';
import { TextLink } from '@/components/ui/v3/text-link';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import ProIllustration from './ProIllustration';

interface UpgradeBannerProps {
  section: string;
  icon?: ComponentType<{ className?: string }>;
}

export default function UpgradeBanner({ section, icon }: UpgradeBannerProps) {
  const { href } = useUpgradePlanLink();
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);
  const track = useTrackEvent();

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per impression, not per re-render
  useEffect(() => {
    track('Upgrade Prompt Viewed', { section });
  }, []);

  const handleTransferDialogOpen = () => setTransferProjectDialogOpen(true);

  return (
    <section className="pro-feature-banner relative overflow-hidden rounded-lg border border-primary/20 bg-primary/[0.04]">
      <span aria-hidden="true" className="pro-banner-blob pro-banner-blob-a" />
      <span aria-hidden="true" className="pro-banner-blob pro-banner-blob-b" />
      <div
        aria-hidden="true"
        className="pointer-events-none mt-4 ml-6 h-20 w-32 text-primary sm:ml-8 lg:absolute lg:inset-y-0 lg:right-0 lg:m-0 lg:h-auto lg:w-1/2"
      >
        <ProIllustration className="h-full w-full opacity-90" icon={icon} />
      </div>

      <div className="relative max-w-xl px-6 py-6 sm:px-8 sm:py-8">
        <h3 className="font-semibold text-2xl tracking-tight">
          Unlock this feature with Nhost Pro
        </h3>
        <p className="mt-2 max-w-sm text-muted-foreground text-sm leading-relaxed">
          This feature is available on Pro and Team plans. Upgrade this
          organization, or transfer the project to an organization that is
          already on a paid plan.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {href && (
            <Button asChild>
              <Link
                href={href}
                onClick={() =>
                  track('Upgrade Prompt Clicked', { section, cta: 'upgrade' })
                }
              >
                Upgrade to Pro
              </Link>
            </Button>
          )}
          <OpenTransferDialogButton
            variant="outline"
            buttonText="Transfer project"
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
        </div>
        <TextLink
          href="https://nhost.io/pricing"
          external
          onClick={() =>
            track('Upgrade Prompt Clicked', {
              section,
              cta: 'see_all_features',
            })
          }
          className="mt-3 justify-center font-medium"
        >
          See all features
        </TextLink>
      </div>
    </section>
  );
}
