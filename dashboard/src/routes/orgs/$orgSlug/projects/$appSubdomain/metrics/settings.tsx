import { createFileRoute } from '@tanstack/react-router';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsGuard } from '@/features/orgs/guards/SettingsGuard';
import { SettingsArea } from '@/features/orgs/projects/common/components/settings/SettingsArea';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { MetricsSettings } from '@/features/orgs/projects/metrics/settings/components/MetricsSettings';
import { useGetObservabilitySettingsQuery } from '@/generated/graphql';

export const Route = createFileRoute(
  '/orgs/$orgSlug/projects/$appSubdomain/metrics/settings',
)({
  component: RouteComponent,
});

function MetricsSettingsPage() {
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
    <div className="grid grid-flow-row gap-y-6">
      <MetricsSettings />
    </div>
  );
}

function RouteComponent() {
  return (
    <SettingsGuard>
      <SettingsArea>
        <MetricsSettingsPage />
      </SettingsArea>
    </SettingsGuard>
  );
}
