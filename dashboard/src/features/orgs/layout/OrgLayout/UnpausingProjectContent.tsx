import type { PropsWithChildren } from 'react';
import { ApplicationPausedBanner } from '@/features/orgs/projects/common/components/ApplicationPausedBanner';
import { useProjectRedirectWhenReady } from '@/features/orgs/projects/common/hooks/useProjectRedirectWhenReady';

function UnpausingProjectContent({ children }: PropsWithChildren) {
  useProjectRedirectWhenReady({ pollInterval: 2000 });

  return (
    <>
      <div className="mx-auto mt-5 flex max-w-7xl p-4 pb-0">
        <ApplicationPausedBanner
          variant="unpausing"
          alertClassName="flex-row"
          textContainerClassName="flex flex-col items-center justify-center text-left"
        />
      </div>
      {children}
    </>
  );
}

export default UnpausingProjectContent;
