import { useRouter } from 'next/router';
import { ApplicationPausedBanner } from '@/features/orgs/projects/common/components/ApplicationPausedBanner';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { ApplicationStatus } from '@/types/application';

type BannerVariant = 'paused' | 'pausing' | 'unpausing';

function getBannerVariant(
  state: ApplicationStatus | undefined,
): BannerVariant | null {
  switch (state) {
    case ApplicationStatus.Paused:
      return 'paused';
    case ApplicationStatus.Pausing:
      return 'pausing';
    case ApplicationStatus.Unpausing:
    case ApplicationStatus.Restoring:
      return 'unpausing';
    default:
      return null;
  }
}

export default function ProjectStateBanner() {
  const { route } = useRouter();
  const { state } = useAppState();

  const isSettingsPage = route.startsWith(
    '/orgs/[orgSlug]/projects/[appSubdomain]/settings',
  );

  const variant = getBannerVariant(state);

  if (!variant || isSettingsPage) {
    return null;
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl shrink-0 p-4 pb-0">
      <ApplicationPausedBanner
        variant={variant}
        alertClassName="flex-row"
        textContainerClassName="flex flex-col items-center justify-center text-left"
        wakeUpButtonClassName="w-fit self-center"
      />
    </div>
  );
}
