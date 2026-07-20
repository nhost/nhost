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
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
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
import { useEffect, useMemo, useState } from 'react';

function trackGraphQLResponse(
  track: (event: string, properties?: Record<string, unknown>) => void,
  payload: unknown,
) {
  const results = Array.isArray(payload) ? payload : [payload];

  const hasErrors = results.some((result) =>
    isNotEmptyValue((result as { errors?: unknown[] })?.errors),
  );

  if (hasErrors) {
    track('GraphQL Failed Response');
    return;
  }

  const hasData = results.some((result) => {
    const data = (result as { data?: Record<string, unknown> })?.data;

    if (!data) {
      return false;
    }

    return Object.values(data).some((value) =>
      Array.isArray(value) ? value.length > 0 : isNotEmptyValue(value),
    );
  });

  track(hasData ? 'GraphQL Response With Data' : 'GraphQL Empty Response');
}

interface GraphiQLHeaderProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string) => void;
  /**
   * Function to be called when the user role changes.
   */
  onRoleChange: (role: string) => void;
}

function GraphiQLHeader({ onUserChange, onRoleChange }: GraphiQLHeaderProps) {
  const copyQuery = useCopyQuery();
  const prettifyEditors = usePrettifyEditors();
  const track = useTrackEvent();

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

    track('GraphQL Query Run');
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
        <UserAndRoleSelect
          onUserChange={onUserChange}
          onRoleChange={onRoleChange}
        />

        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
          <Tooltip title="Prettify query (Shift+Ctrl+P)">
            <Button
              variant="ghost"
              className="col-span-1 py-2 md:col-auto"
              onClick={prettifyEditors}
            >
              Prettify
            </Button>
          </Tooltip>

          <Tooltip title="Copy query (Shift+Ctrl+C)">
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

        <Tooltip title="Execute query (Ctrl+Enter)" placement="bottom-end">
          <Button
            onClick={executeQuery}
            aria-label="Execute GraphQL query"
            className="col-span-1 py-2 md:col-auto"
          >
            <PlayIcon className="mr-2 h-5 w-5" />
            Run
          </Button>
        </Tooltip>
      </div>
    </header>
  );
}

interface GraphiQLEditorProps {
  /**
   * Function to be called when the user changes the headers.
   */
  // biome-ignore lint/suspicious/noExplicitAny: TODO
  onHeaderChange: (headers: Record<string, any>) => void;
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
          // biome-ignore lint/suspicious/noExplicitAny: TODO
          const parsedHeaders: Record<string, any> = JSON.parse(headers);

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
      // biome-ignore lint/suspicious/noExplicitAny: TODO
      const [userHeaders, setUserHeaders] = useState<Record<string, any>>({});

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

      const headers = {
        'content-type': 'application/json',
        'x-hasura-admin-secret': project.config?.hasura.adminSecret,
        ...userHeaders,
      };

      const baseFetcher = createGraphiQLFetcher({
        url: appUrl,
        headers,
        wsClient: createClient({
          url: subscriptionUrl,
          keepAlive: 2000,
          connectionParams: {
            headers,
          },
        }),
      });

      const fetcher: typeof baseFetcher = (graphQLParams, opts) => {
        const result = baseFetcher(graphQLParams, opts);

        if (result instanceof Promise) {
          result
            .then((payload) => trackGraphQLResponse(track, payload))
            .catch(() => track('GraphQL Failed Response'));
        }

        return result;
      };

      function handleUserChange(userId: string) {
        setUserHeaders((currentHeaders) => ({
          ...currentHeaders,
          'x-hasura-user-id': userId,
        }));
      }

      function handleRoleChange(role: string) {
        setUserHeaders((currentHeaders) => ({
          ...currentHeaders,
          'x-hasura-role': role,
        }));
      }

      return (
        <GraphiQLProvider fetcher={fetcher} shouldPersistHeaders>
          <GraphiQLHeader
            onUserChange={handleUserChange}
            onRoleChange={handleRoleChange}
          />

          <GraphiQLEditor onHeaderChange={setUserHeaders} />
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
        className: 'flex flex-col h-full',
        sx: {
          [`& .graphiql-container`]: {
            [`& .graphiql-main, & .graphiql-sessions`]: {
              backgroundColor: 'background.default',
            },
            [`& .graphiql-editors, & .graphiql-editor, & .CodeMirror, & .CodeMirror-gutters, & .graphiql-container .graphiql-doc-explorer, & .graphiql-doc-explorer-search-input + div > ul, & .cm-searching`]:
              {
                backgroundColor: 'background.paper',
              },
            [`& .CodeMirror-linenumber, & .CodeMirror-line, & .graphiql-tabs button.graphiql-tab, & .graphiql-editor-tools-tabs button`]:
              {
                color: 'text.disabled',
              },
            [`& .graphiql-editor-tools-tabs button.active, & .graphiql-tabs button.graphiql-tab-active, & .graphiql-markdown-description, & .graphiql-doc-explorer-section-title`]:
              {
                color: 'text.secondary',
              },
            [`& .graphiql-doc-explorer .graphiql-doc-explorer-header`]: {
              color: 'text.primary',
            },
            [`& .graphiql-tabs button`]: {
              outline: 'none',
            },
            [`& .CodeMirror-hint`]: {
              borderColor: `grey.300`,
            },
          },
        },
      }}
    >
      {page}
    </OrgLayout>
  );
};
