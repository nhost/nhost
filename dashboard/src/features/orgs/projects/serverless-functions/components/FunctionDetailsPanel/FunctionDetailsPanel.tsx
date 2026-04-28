import { FileCode } from 'lucide-react';
import { useRouter } from 'next/router';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ExecuteTab } from '@/features/orgs/projects/serverless-functions/components/ExecuteTab';
import { FunctionLogsTab } from '@/features/orgs/projects/serverless-functions/components/FunctionLogsTab';
import { OverviewTab } from '@/features/orgs/projects/serverless-functions/components/OverviewTab';
import {
  type FunctionTab,
  isFunctionTab,
  type NhostFunction,
} from '@/features/orgs/projects/serverless-functions/types';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';

export interface FunctionDetailsPanelProps {
  fn: NhostFunction;
}

export default function FunctionDetailsPanel({
  fn,
}: FunctionDetailsPanelProps) {
  const router = useRouter();
  const activeTab: FunctionTab = isFunctionTab(router.query.tab)
    ? router.query.tab
    : 'overview';

  const handleTabChange = (newTab: FunctionTab) => {
    router.replace(
      {
        pathname: router.pathname,
        query: { ...router.query, tab: newTab },
      },
      undefined,
      { shallow: true, scroll: false },
    );
  };

  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const appClient = useAppClient();
  const defaultEndpointUrl = `${appClient.functions.baseURL}${fn.route}`;

  const { data: customDomainData } = useGetServerlessFunctionsSettingsQuery({
    variables: {
      appId: project?.id,
    },
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const customDomainFqdn =
    customDomainData?.config?.functions?.resources?.networking?.ingresses?.[0]
      ?.fqdn?.[0];

  const endpointUrl = customDomainFqdn
    ? `https://${customDomainFqdn}/v1${fn.route}`
    : defaultEndpointUrl;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="border-b-1 bg-background px-6 pt-6 pb-0">
        <div className="pb-6">
          <h1 className="mb-1 font-semibold text-gray-900 text-xl dark:text-gray-100">
            {fn.route}
          </h1>
          <p className="flex items-center gap-1.5 text-gray-600 text-sm dark:text-gray-400">
            <FileCode className="h-3.5 w-3.5" />
            {fn.path}
          </p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => handleTabChange(v as FunctionTab)}
          className="my-4"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {activeTab === 'logs' && (
        <div className="flex-1 overflow-hidden">
          <FunctionLogsTab fn={fn} />
        </div>
      )}
      {activeTab === 'execute' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <ExecuteTab endpointUrl={defaultEndpointUrl} />
        </div>
      )}
      {activeTab === 'overview' && (
        <div className="flex-1 overflow-auto p-6">
          <OverviewTab
            fn={fn}
            endpointUrl={endpointUrl}
            defaultEndpointUrl={
              customDomainFqdn ? defaultEndpointUrl : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
