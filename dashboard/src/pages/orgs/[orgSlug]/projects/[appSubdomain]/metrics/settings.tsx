import type { ReactElement } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { getMetricsLayout } from '@/features/orgs/projects/metrics/layout';
import { MetricsSettings } from '@/features/orgs/projects/metrics/settings/components/MetricsSettings';
import { useGetObservabilitySettingsQuery } from '@/generated/graphql';

export default function MetricsSettingsPage() {
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project, loading: loadingProject } = useProject();

  const { data, error } = useGetObservabilitySettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
    skip: !project?.id,
  });

  if (error) {
    throw error;
  }

  const isInitialLoading = loadingProject || !project?.id || !data;

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading metrics settings...
      </Spinner>
    );
  }

  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <div className="grid grid-flow-row gap-y-6">
          <MetricsSettings />
        </div>
      </div>
    </SettingsLayout>
  );
}

MetricsSettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getMetricsLayout(page, {
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
