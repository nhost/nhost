import type { ReactElement } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Spinner } from '@/components/ui/v3/spinner';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { getAILayout } from '@/features/orgs/projects/ai/layout';
import { AISettings } from '@/features/orgs/projects/ai/settings/components';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import {
  Software_Type_Enum,
  useGetAiSettingsQuery,
  useGetSoftwareVersionsQuery,
} from '@/generated/graphql';

export default function AISettingsPage() {
  const { org, error } = useCurrentOrg();
  const { project, loading: loadingProject } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();

  const { data, error: errorGettingAiSettings } = useGetAiSettingsQuery({
    variables: { appId: project?.id },
    ...(!isPlatform ? { client: localMimirClient } : {}),
    skip: org?.plan?.isFree || !project?.id,
  });

  const { data: graphiteVersionsData, loading: loadingGraphiteVersionsData } =
    useGetSoftwareVersionsQuery({
      variables: { software: Software_Type_Enum.Graphite },
      skip: org?.plan?.isFree || !isPlatform,
    });

  if (org?.plan?.isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-ai"
          title="To unlock AI, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  if (error || errorGettingAiSettings) {
    throw error || errorGettingAiSettings;
  }

  const isInitialLoading =
    loadingProject ||
    !project?.id ||
    !data ||
    (isPlatform && loadingGraphiteVersionsData && !graphiteVersionsData);

  if (isInitialLoading) {
    return (
      <Spinner size="medium" wrapperClassName="gap-2">
        Loading AI settings...
      </Spinner>
    );
  }

  return (
    <SettingsLayout>
      <div className="w-full px-5 py-4">
        <div className="grid grid-flow-row gap-y-6">
          <AISettings />
        </div>
      </div>
    </SettingsLayout>
  );
}

AISettingsPage.getLayout = function getLayout(page: ReactElement) {
  return getAILayout(page, {
    bodyClassName: 'self-center w-full max-w-[1000px]',
    contentClassName: 'flex flex-col',
  });
};
