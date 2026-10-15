import { useNavigate, useSearch } from '@tanstack/react-router';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
import { Clock, Code, FileCode, History } from 'lucide-react';
import { useEffect } from 'react';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Container } from '@/components/layout/Container';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/v3/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useAppClient } from '@/features/orgs/projects/hooks/useAppClient';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ExecuteTab } from '@/features/orgs/projects/serverless-functions/components/ExecuteTab';
import { FunctionLogsTab } from '@/features/orgs/projects/serverless-functions/components/FunctionLogsTab';
import { MetricsTab } from '@/features/orgs/projects/serverless-functions/components/MetricsTab';
import { OverviewTab } from '@/features/orgs/projects/serverless-functions/components/OverviewTab';
import type {
  FunctionTab,
  NhostFunction,
} from '@/features/orgs/projects/serverless-functions/types';
import { useGetServerlessFunctionsSettingsQuery } from '@/generated/graphql';

function formatTimeAgo(dateString: string): string {
  return `${formatDistanceToNowStrict(parseISO(dateString))} ago`;
}

function isPlaceholderDate(date: string): boolean {
  return date.startsWith('0001-01-01');
}

export interface FunctionDetailsPanelProps {
  fn: NhostFunction;
}

export default function FunctionDetailsPanel({
  fn,
}: FunctionDetailsPanelProps) {
  const navigate = useNavigate({
    from: '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$',
  });
  const { tab } = useSearch({
    from: '/orgs/$orgSlug/projects/$appSubdomain/functions/browser/$',
  });
  const isPlatform = useIsPlatform();
  const activeTab: FunctionTab = tab ?? 'overview';

  useEffect(() => {
    if (activeTab === 'metrics' && !isPlatform) {
      navigate({ to: '/404' });
    }
  }, [activeTab, isPlatform, navigate]);

  const handleTabChange = (newTab: FunctionTab) => {
    navigate({
      search: (prev) => ({ ...prev, tab: newTab }),
      replace: true,
      resetScroll: false,
    });
  };

  const { org } = useCurrentOrg();
  const localMimirClient = useLocalMimirClient();
  const { project } = useProject();
  const appClient = useAppClient();
  const defaultEndpointUrl = `${appClient.functions.baseURL}${fn.route}`;

  const showMetricsPaywall = isPlatform && org?.plan?.isFree;

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
        <div className="pb-4">
          <div className="flex items-start gap-3">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted">
              <Code className="h-6 w-6 text-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="mb-1 font-semibold text-foreground text-xl">
                {fn.route}
              </h1>
              <p className="flex items-center gap-1.5 text-muted-foreground text-sm">
                <FileCode className="h-3.5 w-3.5" />
                {fn.path}
              </p>
            </div>
          </div>
          {(!isPlaceholderDate(fn.createdAt) ||
            !isPlaceholderDate(fn.updatedAt)) && (
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-sm">
              {!isPlaceholderDate(fn.createdAt) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Created {formatTimeAgo(fn.createdAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{fn.createdAt}</TooltipContent>
                </Tooltip>
              )}
              {!isPlaceholderDate(fn.createdAt) &&
                !isPlaceholderDate(fn.updatedAt) && (
                  <span aria-hidden="true" className="text-muted-foreground/50">
                    |
                  </span>
                )}
              {!isPlaceholderDate(fn.updatedAt) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex cursor-default items-center gap-1.5">
                      <History className="h-3.5 w-3.5" />
                      Last Updated {formatTimeAgo(fn.updatedAt)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{fn.updatedAt}</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>

        <Tabs
          value={activeTab}
          onValueChange={(v) => handleTabChange(v as FunctionTab)}
          className="my-6"
        >
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="execute">Execute</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
            <TabsTrigger value="metrics" disabled={!isPlatform}>
              Metrics
            </TabsTrigger>
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
      {activeTab === 'metrics' && isPlatform && (
        <div className="flex-1 overflow-auto">
          {showMetricsPaywall ? (
            <Container
              className="grid grid-flow-row gap-6 bg-transparent"
              rootClassName="bg-transparent"
            >
              <UpgradeToProBanner
                section="serverless-functions-metrics"
                title="To unlock Function Metrics, transfer this project to a Pro or Team organization."
                description=""
              />
            </Container>
          ) : (
            <MetricsTab fn={fn} />
          )}
        </div>
      )}
    </div>
  );
}
