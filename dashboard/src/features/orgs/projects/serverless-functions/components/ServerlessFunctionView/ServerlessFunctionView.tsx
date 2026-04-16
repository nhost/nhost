import { FileCode } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { Spinner } from '@/components/ui/v3/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ExecuteTab } from '@/features/orgs/projects/serverless-functions/components/ExecuteTab';
import { FunctionLogsTab } from '@/features/orgs/projects/serverless-functions/components/FunctionLogsTab';
import { FunctionsEmptyState } from '@/features/orgs/projects/serverless-functions/components/FunctionsEmptyState';
import { OverviewTab } from '@/features/orgs/projects/serverless-functions/components/OverviewTab';
import { useGetNhostFunctions } from '@/features/orgs/projects/serverless-functions/hooks/useGetNhostFunctions';
import type { NhostFunction } from '@/features/orgs/projects/serverless-functions/types';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';

function FunctionDetailsPanel({ fn }: { fn: NhostFunction }) {
  const [tab, setTab] = useState('overview');
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

        <Tabs value={tab} onValueChange={setTab} className="my-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === 'logs' && (
        <div className="flex-1 overflow-hidden">
          <FunctionLogsTab fn={fn} />
        </div>
      )}
      {tab === 'execute' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          <ExecuteTab endpointUrl={defaultEndpointUrl} />
        </div>
      )}
      {tab === 'overview' && (
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

export default function ServerlessFunctionView() {
  const router = useRouter();
  const { functionSlug } = router.query;
  const slug = Array.isArray(functionSlug)
    ? functionSlug.join('/')
    : (functionSlug as string);

  const { data: functions, loading, error } = useGetNhostFunctions();

  if (loading) {
    return (
      <div className="flex h-full justify-center">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{slug}
            </code>{' '}
            could not be loaded.
          </span>
        }
      />
    );
  }

  const fn = functions.find((func) => func.route.replace(/^\//, '') === slug);

  if (!fn) {
    return (
      <FunctionsEmptyState
        title="Function not found"
        description={
          <span>
            Function{' '}
            <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-medium font-mono text-sm">
              /{slug}
            </code>{' '}
            does not exist.
          </span>
        }
      />
    );
  }

  return <FunctionDetailsPanel fn={fn} />;
}
