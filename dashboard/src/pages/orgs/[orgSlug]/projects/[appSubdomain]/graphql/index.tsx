import {
  DOC_EXPLORER_PLUGIN,
  GraphiQLProvider,
  useCopyQuery,
  useExecutionContext,
  usePluginContext,
  usePrettifyEditors,
  useTheme,
} from '@graphiql/react';
import { PlayIcon } from 'lucide-react';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
  withRequestHeaders,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';
import '@graphiql/react/dist/style.css';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQLInterface } from 'graphiql';
import 'graphiql/graphiql.min.css';
import { createClient } from 'graphql-ws';
import debounce from 'lodash.debounce';
import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

function trackGraphQLResponse(
  track: (event: string, properties?: Record<string, unknown>) => void,
  payload: unknown,
) {
  const results = Array.isArray(payload) ? payload : [payload];

  const hasErrors = results.some((result) =>
    isNotEmptyValue((result as { errors?: unknown[] })?.errors),
  );

  if (hasErrors) {
    track('GraphQL Query Run', { outcome: 'failed' });
    return;
  }

  const hasData = results.some((result) => {
    const data = (result as { data?: Record<string, unknown> })?.data;

    return data !== null && data !== undefined;
  });

  track('GraphQL Query Run', { outcome: hasData ? 'data' : 'empty' });
}

interface GraphiQLHeaderProps {
  /**
   * Function to be called when the user or role changes.
   */
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
}

function GraphiQLHeader({ onSelectionChange }: GraphiQLHeaderProps) {
  const copyQuery = useCopyQuery();
  const prettifyEditors = usePrettifyEditors();

  const executionContext = useExecutionContext();

  const isQueryFetching = isNotEmptyValue(executionContext)
    ? !!executionContext?.isFetching
    : false;
  const runQuery = isNotEmptyValue(executionContext)
    ? executionContext.run
    : () => {};
  const stopQuery = isNotEmptyValue(executionContext)
    ? executionContext.stop
    : () => {};
  const { theme, setTheme } = useTheme();
  const pluginContext = usePluginContext();

  const visiblePlugin = isNotEmptyValue(pluginContext)
    ? pluginContext.visiblePlugin
    : null;
  const setVisiblePlugin = isNotEmptyValue(pluginContext)
    ? pluginContext.setVisiblePlugin
    : () => {};

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light');
    }
  }, [setTheme, theme]);

  function executeQuery() {
    if (isQueryFetching) {
      stopQuery();
    }

    runQuery();
  }

  // This is a very hacky way to toggle the plugin visibility. Although
  // GraphiQL exposes a way to manage plugins via the `PluginContext`, it
  // does not expose a way to manage the layout of the plugins. This means
  // that we have to manually manipulate the DOM to make the documentation
  // explorer plugin pretty.
  function toggleDocumentationExplorer() {
    const PLUGIN_VISIBLE_CLASS = 'graphiql-plugin-visible';
    const [mainGraphiQLContainer] =
      document.getElementsByClassName('graphiql-main');
    const pluginContainer = mainGraphiQLContainer.firstChild as HTMLElement;

    const editor = mainGraphiQLContainer.lastChild as HTMLElement;

    if (visiblePlugin?.title === DOC_EXPLORER_PLUGIN.title) {
      setVisiblePlugin(null);

      if (pluginContainer) {
        pluginContainer.style.left = '-1000px';
        pluginContainer.style.position = 'absolute';
        pluginContainer.style.opacity = '0';
        pluginContainer.style.height = '500px';
        pluginContainer.style.width = '500px';
      }

      if (editor) {
        editor.classList.remove(PLUGIN_VISIBLE_CLASS);
      }

      return;
    }

    if (pluginContainer) {
      pluginContainer.style.width = '';
      pluginContainer.style.height = '';
      pluginContainer.style.opacity = '';
      pluginContainer.style.position = '';
      pluginContainer.style.left = '';
    }

    if (editor) {
      editor.classList.add(PLUGIN_VISIBLE_CLASS);
    }

    setVisiblePlugin(DOC_EXPLORER_PLUGIN.title);
  }

  return (
    <header className="grid grid-flow-row items-end gap-2 p-2 md:grid-flow-col md:justify-between">
      <div className="grid grid-flow-row gap-2 md:grid-flow-col md:items-end">
        <UserAndRoleSelect onSelectionChange={onSelectionChange} />

        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="col-span-1 py-2 md:col-auto"
                onClick={prettifyEditors}
              >
                Prettify
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Prettify query (Shift+Ctrl+P)
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                onClick={() => {
                  copyQuery();
                  triggerToast('Query copied to clipboard');
                }}
                className="col-span-1 md:col-auto"
              >
                Copy GraphQL
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={8}>
              Copy query (Shift+Ctrl+C)
            </TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
        <Button
          variant="ghost"
          onClick={toggleDocumentationExplorer}
          className="col-span-1 md:col-auto"
        >
          Docs
        </Button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={executeQuery}
              aria-label="Execute GraphQL query"
              className="col-span-1 py-2 md:col-auto"
            >
              <PlayIcon className="mr-2 h-5 w-5" />
              Run
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" align="end" sideOffset={8}>
            Execute query (Ctrl+Enter)
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

interface GraphiQLEditorProps {
  /**
   * Function to be called when the user changes the headers.
   */
  onHeaderChange: (headers: Record<string, unknown>) => void;
}

function GraphiQLEditor({ onHeaderChange }: GraphiQLEditorProps) {
  const handleUserHeaderChange = useMemo(
    () =>
      debounce((headers: string) => {
        if (!headers) {
          onHeaderChange({});

          return;
        }

        try {
          const parsedHeaders: Record<string, unknown> = JSON.parse(headers);

          onHeaderChange(parsedHeaders);
        } catch {
          // We are not going to do anything if the headers are not valid JSON.
        }
      }, 200),
    [onHeaderChange],
  );

  useEffect(() => {
    handleUserHeaderChange.cancel();
  }, [handleUserHeaderChange]);

  return (
    <GraphiQLInterface
      defaultEditorToolsVisibility="variables"
      onEditHeaders={handleUserHeaderChange}
    />
  );
}

const GraphQLPageContent = dynamic(
  () =>
    Promise.resolve(() => {
      const { project } = useProject();
      const track = useTrackEvent();
      const [selection, setSelection] = useState<GraphQLPlaygroundSelection>({
        userId: '',
        role: '',
      });
      const [headersTabOverrides, setHeadersTabOverrides] = useState<
        Record<string, unknown>
      >({});
      const handleSelectionChange = useCallback(
        (nextSelection: GraphQLPlaygroundSelection) => {
          setSelection(nextSelection);
        },
        [],
      );

      if (!project?.subdomain || !project?.config?.hasura.adminSecret) {
        return <LoadingScreen />;
      }

      const appUrl = generateAppServiceUrl(
        project.subdomain,
        project.region,
        'graphql',
      );

      const subscriptionUrl = `${appUrl
        .replace('https', 'wss')
        .replace('http', 'ws')}`;

      const adminSecret = project.config?.hasura.adminSecret;

      let socketHeaders: Record<string, string>;

      try {
        socketHeaders = composeRequestHeaders({
          adminSecret,
          selection,
          headersTabOverrides,
        });
      } catch {
        // Header names are invalid while one is still being typed; executing a
        // query re-composes them and surfaces the rejection in the response pane.
        socketHeaders = composeRequestHeaders({ adminSecret, selection });
      }
      const baseFetcher = createGraphiQLFetcher({
        url: appUrl,
        // Response analytics cover non-incremental HTTP queries and mutations.
        // WebSocket subscriptions are returned unchanged and intentionally untracked.
        enableIncrementalDelivery: false,
        wsClient: createClient({
          url: subscriptionUrl,
          keepAlive: 2000,
          // @graphiql/toolkit ignores per-execution headers for subscriptions
          // when a wsClient is supplied, so they must use connectionParams.
          connectionParams: {
            headers: socketHeaders,
          },
        }),
      });
      const requestFetcher = withRequestHeaders({
        fetcher: baseFetcher,
        adminSecret,
        selection,
      });
      const fetcher: typeof baseFetcher = (graphQLParams, fetcherOpts) => {
        const result = requestFetcher(graphQLParams, fetcherOpts);

        if (
          graphQLParams.operationName !== 'IntrospectionQuery' &&
          result instanceof Promise
        ) {
          result
            .then((payload) => trackGraphQLResponse(track, payload))
            .catch(() =>
              track('GraphQL Query Run', { outcome: 'request_error' }),
            );
        }

        return result;
      };

      return (
        <GraphiQLProvider fetcher={fetcher} shouldPersistHeaders>
          <GraphiQLHeader onSelectionChange={handleSelectionChange} />

          <GraphiQLEditor onHeaderChange={setHeadersTabOverrides} />
        </GraphiQLProvider>
      );
    }),
  { ssr: false },
);

export default function GraphQLPage() {
  return (
    <RetryableErrorBoundary>
      <GraphQLPageContent />
    </RetryableErrorBoundary>
  );
}

GraphQLPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout
      mainContainerProps={{
        className: 'graphiql-themed flex h-full flex-col',
      }}
    >
      {page}
    </OrgLayout>
  );
};
