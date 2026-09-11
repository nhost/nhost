import { useRouter } from 'next/router';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { OpenTransferDialogButton } from '@/components/common/OpenTransferDialogButton';
import { ProIllustration } from '@/components/common/UpgradeBanner/ProIllustration';
import { Button } from '@/components/ui/v3/button';
import { TextLink } from '@/components/ui/v3/text-link';
import { TransferProjectDialog } from '@/features/orgs/components/common/TransferProjectDialog';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useTrackEvent } from '@/hooks/useTrackEvent';

interface UpgradeBannerProps {
  // Analytics grouping key: use a route-area slug (for example, run).
  section: string;
  // The icon this feature already uses in the main menu (for example the
  // AI, Run, or Metrics icon). Falls back to the Nhost mark when omitted.
  icon?: ComponentType<{ className?: string }>;
}

/**
 * Generic "this needs a paid plan" banner. One shared message and layout
 * everywhere it's used, no per-feature copy, so a future change to it
 * updates every page at once.
 */
export default function UpgradeBanner({ section, icon }: UpgradeBannerProps) {
  const router = useRouter();
  const { org } = useCurrentOrg();
  const [transferProjectDialogOpen, setTransferProjectDialogOpen] =
    useState(false);
  const track = useTrackEvent();

  // biome-ignore lint/correctness/useExhaustiveDependencies: fire once per impression, not per re-render
  useEffect(() => {
    track('Upgrade Prompt Viewed', { section });
  }, []);

  function handleUpgradeClick() {
    track('Upgrade Prompt Clicked', { section, cta: 'upgrade' });

    if (!org?.slug) {
      return;
    }

    router.push(`/orgs/${org.slug}/billing?openUpgradeModal=true`);
  }

  return (
    <section className="pro-feature-banner relative overflow-hidden rounded-xl border border-primary/20 bg-primary/[0.04]">
      <span
        aria-hidden="true"
        className="pro-banner-blob pro-banner-blob-a"
      />
      <span
        aria-hidden="true"
        className="pro-banner-blob pro-banner-blob-b"
      />
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 text-primary sm:block">
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
          <Button onClick={handleUpgradeClick} className="max-w-xs sm:w-auto">
            Upgrade to Pro
          </Button>

          <OpenTransferDialogButton
            variant="outline-emboss"
            buttonText="Transfer project"
            onClick={() => setTransferProjectDialogOpen(true)}
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
          className="mt-3 justify-center font-medium"
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
    </section>
  );
}
