import {
  GraphiQLProvider,
  PlusIcon,
  Tab,
  Tabs,
  UnStyledButton,
  useCopyQuery,
  useEditorContext,
  useExecutionContext,
  usePrettifyEditors,
  useTheme,
} from '@graphiql/react';
import {
  Braces,
  ChevronDown,
  Copy,
  PlayIcon,
  WandSparkles,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { CopyToClipboardButton } from '@/components/presentational/CopyToClipboardButton';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { ProjectScope } from '@/features/orgs/guards/ProjectScope';
import { generateAppServiceUrl } from '@/features/orgs/projects/common/utils/generateAppServiceUrl';
import {
  DOCS_PANEL_PLUGIN,
  HISTORY_PANEL_PLUGIN,
  MobileQueryViewProvider,
  PanelTabButton,
  PlaygroundPanels,
  type PlaygroundPanelTab,
  useMobileQueryView,
  usePlaygroundPanelTab,
} from '@/features/orgs/projects/graphql/common/components/PlaygroundPanels';
import {
  ClearRecentButton,
  useHistoryCount,
} from '@/features/orgs/projects/graphql/common/components/QueryHistory';
import {
  ResponseStatus,
  ResponseStatusContext,
} from '@/features/orgs/projects/graphql/common/components/ResponseStatus';
import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
import { PLAYGROUND_ICON_BUTTON_CLASSES as ICON_BUTTON_CLASSES } from '@/features/orgs/projects/graphql/common/constants/playground';
import {
  buildCurlSnippet,
  buildFetchSnippet,
  getHeaderEnvName,
} from '@/features/orgs/projects/graphql/common/utils/buildRequestSnippet';
import {
  composeRequestHeaders,
  type GraphQLPlaygroundSelection,
  withRequestHeaders,
} from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import {
  getQueryLabel,
  UNNAMED_QUERY_TITLE,
} from '@/features/orgs/projects/graphql/common/utils/getQueryLabel';
import {
  createResponseMeter,
  createResponseStatusStore,
} from '@/features/orgs/projects/graphql/common/utils/measureResponse';
import {
  createPlaygroundStorage,
  removeSharedPlaygroundStorage,
} from '@/features/orgs/projects/graphql/common/utils/playgroundStorage';
import { GraphQLArea } from '@/features/orgs/projects/graphql/layout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';
import { triggerToast } from '@/utils/toast';
import '@graphiql/react/dist/style.css';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQL, GraphiQLInterface } from 'graphiql';
import 'graphiql/graphiql.min.css';
import { createClient } from 'graphql-ws';
import debounce from 'lodash.debounce';
import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';
import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';

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

// What each run sends: used by the copy menu.
interface PlaygroundRequest {
  endpoint: string;
  adminSecret: string;
  selection: GraphQLPlaygroundSelection;
  headersTabOverrides: Record<string, unknown>;
}

function GraphiQLHeader({ onSelectionChange }: GraphiQLHeaderProps) {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    if (theme !== 'light') {
      setTheme('light');
    }
  }, [setTheme, theme]);

  return (
    <header className="px-4 pt-4 pb-2">
      <UserAndRoleSelect onSelectionChange={onSelectionChange} />
    </header>
  );
}

// Label shown on a tab: GraphiQL's title for a named operation, otherwise a
// name taken from the query. Display only, GraphiQL's tab state is not changed.
function getTabLabel(tab: { title: string; query: string | null }) {
  return tab.title !== UNNAMED_QUERY_TITLE
    ? tab.title
    : getQueryLabel(tab.query);
}

// GraphiQL hides its tab bar while there is only one tab and shows a
// separate plus button on the right instead. We render our own tab bar inside
// GraphiQL's session header so the first tab is always visible with the plus
// right next to it. Tab behaviour mirrors GraphiQL's built in tab bar.
function GraphiQLSessionTabs() {
  const editorContext = useEditorContext({ nonNull: true });
  const executionContext = useExecutionContext({ nonNull: true });
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setContainer(
      document.querySelector<HTMLElement>(
        '.graphiql-container .graphiql-session-header',
      ),
    );
  }, []);

  if (!container) {
    return null;
  }

  const hasMultipleTabs = editorContext.tabs.length > 1;

  return createPortal(
    <Tabs values={editorContext.tabs} onReorder={editorContext.moveTab}>
      {editorContext.tabs.map((tab, index) => (
        <Tab
          key={tab.id}
          value={tab}
          isActive={index === editorContext.activeTabIndex}
        >
          <Tab.Button
            aria-controls="graphiql-session"
            id={`graphiql-session-tab-${index}`}
            // GraphiQL gives the tab label left padding only. Same right
            // padding with or without a close button, so the hover
            // background doesn't stop right at the last letter.
            className="!pr-2"
            onClick={() => {
              executionContext.stop();
              editorContext.changeTab(index);
            }}
          >
            {getTabLabel(tab)}
          </Tab.Button>

          {hasMultipleTabs && (
            <Tab.Close
              onClick={() => {
                if (editorContext.activeTabIndex === index) {
                  executionContext.stop();
                }

                editorContext.closeTab(index);
              }}
            />
          )}
        </Tab>
      ))}

      <Tooltip>
        <TooltipTrigger asChild>
          <UnStyledButton
            type="button"
            className="graphiql-tab-add"
            onClick={editorContext.addTab}
            aria-label="Add tab"
          >
            <PlusIcon aria-hidden="true" />
          </UnStyledButton>
        </TooltipTrigger>
        <TooltipContent side="top">Add tab</TooltipContent>
      </Tooltip>
    </Tabs>,
    container,
  );
}

// The request exactly as the playground would send it, for the copy menu.
function getRequestHeaders({
  adminSecret,
  selection,
  headersTabOverrides,
}: PlaygroundRequest) {
  try {
    return composeRequestHeaders({
      adminSecret,
      selection,
      headersTabOverrides,
    });
  } catch {
    // A header name in the Headers tab is not valid yet (e.g. while typing).
    return composeRequestHeaders({ adminSecret, selection });
  }
}

// Title bar on top of the query editor. GraphiQL has no slot there, so we
// add an element as the first child of its editors container.
function QueryPaneHeader({ request }: { request: PlaygroundRequest }) {
  const editorContext = useEditorContext({ nonNull: true });
  const executionContext = useExecutionContext({ nonNull: true });

  const { queryEditor } = editorContext;
  const [hasQuery, setHasQuery] = useState(true);

  // Run is off while the editor holds nothing to run: empty, or only
  // comments (like GraphiQL's welcome text).
  useEffect(() => {
    if (!queryEditor) {
      return undefined;
    }

    const update = () =>
      setHasQuery(queryEditor.getValue().replace(/#.*$/gm, '').trim() !== '');

    update();
    queryEditor.on('change', update);

    return () => {
      queryEditor.off('change', update);
    };
  }, [queryEditor]);

  // Same as before the move: a run in progress is stopped, then run again.
  function executeQuery() {
    if (executionContext.isFetching) {
      executionContext.stop();
    }

    executionContext.run();
  }
  const copyQuery = useCopyQuery();
  const prettifyEditors = usePrettifyEditors();
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const editors = document.querySelector<HTMLElement>(
      '.graphiql-container .graphiql-editors',
    );

    if (!editors) {
      return undefined;
    }

    const slot = document.createElement('div');
    slot.className = 'graphiql-pane-header-slot';
    editors.prepend(slot);
    setContainer(slot);

    // GraphiQL makes the whole Variables/Headers bar its drag handle, tabs
    // included. A press on a tab or the collapse arrow stays a click: it never
    // reaches the drag handler. The empty part of the bar still drags.
    function keepButtonsClickable(event: MouseEvent) {
      if (
        event.target instanceof Element &&
        event.target.closest('.graphiql-editor-tools button')
      ) {
        event.stopPropagation();
      }
    }

    editors.addEventListener('mousedown', keepButtonsClickable, true);

    return () => {
      editors.removeEventListener('mousedown', keepButtonsClickable, true);
      slot.remove();
    };
  }, []);

  function copyRequest(
    build: typeof buildCurlSnippet,
    format: 'cURL' | 'fetch',
  ) {
    let variables: Record<string, unknown> = {};
    const variablesText = editorContext.variableEditor?.getValue().trim();

    if (variablesText) {
      try {
        variables = JSON.parse(variablesText);
      } catch {
        triggerToast('Variables are not valid JSON');
        return;
      }
    }

    const headers = getRequestHeaders(request);

    copy(
      build({
        endpoint: request.endpoint,
        headers,
        query: editorContext.queryEditor?.getValue() ?? '',
        variables,
      }),
    );
    const envNames = Object.keys(headers)
      .map(getHeaderEnvName)
      .filter((envName) => envName !== null);

    triggerToast(
      envNames.length > 0
        ? `Copied as ${format}. Set ${envNames.join(', ')} to run it.`
        : `Copied as ${format}`,
    );
  }

  if (!container) {
    return null;
  }

  return createPortal(
    // Phones use the bar above instead (MobilePlaygroundBar): its Query tab
    // and Run. Prettify and the copy menu are desktop extras.
    <div className="hidden h-12 shrink-0 items-center justify-between border-b pr-2 pl-4 md:flex">
      <span className="font-medium text-foreground text-sm">Query</span>
      <div className="flex items-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="subtle"
              size="icon"
              className={ICON_BUTTON_CLASSES}
              onClick={prettifyEditors}
              aria-label="Prettify query"
            >
              <WandSparkles className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Prettify</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="subtle"
              size="icon"
              className={ICON_BUTTON_CLASSES}
              onClick={() => {
                copyQuery();
                triggerToast('Query copied to clipboard');
              }}
              aria-label="Copy query"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">Copy query</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="subtle"
                  size="icon"
                  className={cn(ICON_BUTTON_CLASSES, '-ml-2 w-6')}
                  aria-label="More copy options"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">More copy options</TooltipContent>
          </Tooltip>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                copyQuery();
                triggerToast('Query copied to clipboard');
              }}
            >
              Copy query
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => copyRequest(buildCurlSnippet, 'cURL')}
            >
              Copy as cURL
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => copyRequest(buildFetchSnippet, 'fetch')}
            >
              Copy as fetch
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Tooltip>
          <TooltipTrigger asChild>
            {/* A disabled button gets no hover, so the span carries the tooltip. */}
            <span className="ml-3 inline-flex">
              <Button
                size="xs"
                onClick={executeQuery}
                disabled={!hasQuery}
                aria-label="Execute GraphQL query"
                className="gap-1.5 px-2.5"
              >
                <PlayIcon className="h-3.5 w-3.5" />
                Run
              </Button>
            </span>
          </TooltipTrigger>
          <TooltipContent side="top">
            {hasQuery ? 'Run (Ctrl+Enter)' : 'Write a query to run it'}
          </TooltipContent>
        </Tooltip>
      </div>
    </div>,
    container,
  );
}

// Tabs and empty state for the response pane, rendered through GraphiQL's
// footer slot (moved to the top of the pane with CSS). Response, History and
// Docs share the pane: History and Docs cover the response while open.
function ResponsePaneExtras() {
  const editorContext = useEditorContext({ nonNull: true });
  const executionContext = useExecutionContext({ nonNull: true });
  const [tab, setTab] = usePlaygroundPanelTab();
  const { setShowQuery } = useMobileQueryView();
  const historyCount = useHistoryCount();
  const { isFetching } = executionContext;
  const { responseEditor } = editorContext;
  const [response, setResponse] = useState('');
  const responseStatusStore = useContext(ResponseStatusContext);
  const activeTabId = editorContext.tabs[editorContext.activeTabIndex]?.id;

  // The status belongs to the last run, so it is cleared when
  // another tab becomes active.
  useEffect(() => {
    if (activeTabId) {
      responseStatusStore?.reset();
    }
  }, [activeTabId, responseStatusStore]);

  // A run shows its response, whichever tab was open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only on a new run
  useEffect(() => {
    if (isFetching) {
      setTab('response');
      setShowQuery(false);
    }
  }, [isFetching]);

  useEffect(() => {
    if (!responseEditor) {
      return undefined;
    }

    const update = () => setResponse(responseEditor.getValue());

    update();
    responseEditor.on('change', update);

    return () => {
      responseEditor.off('change', update);
    };
  }, [responseEditor]);

  return (
    <>
      <div className="flex h-12 shrink-0 items-stretch justify-between border-b pr-2 pl-4">
        {/* On phones these tabs are in the bar above the panes. */}
        <div
          role="tablist"
          className="hidden min-w-0 items-stretch gap-6 md:flex"
        >
          <PanelTabButton
            active={tab === 'response'}
            onClick={() => setTab('response')}
          >
            Response
          </PanelTabButton>
          <PanelTabButton
            active={tab === 'history'}
            onClick={() => setTab('history')}
          >
            History
            {historyCount > 0 && (
              <span className="rounded-full bg-primary/10 px-1.5 font-medium text-primary text-xs leading-5">
                {historyCount}
              </span>
            )}
          </PanelTabButton>
          <PanelTabButton
            active={tab === 'docs'}
            onClick={() => setTab('docs')}
          >
            Docs
          </PanelTabButton>
        </div>

        {tab === 'history' && (
          <div className="flex items-center">
            <ClearRecentButton />
          </div>
        )}

        {tab === 'response' && (
          <div className="flex items-center gap-2">
            <ResponseStatus />
            {response && (
              <span className="hidden md:inline-flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <CopyToClipboardButton
                      textToCopy={response}
                      title="Response"
                      aria-label="Copy response"
                      className={cn(
                        ICON_BUTTON_CLASSES,
                        'h-8 w-8 p-0 hover:bg-transparent dark:hover:bg-transparent',
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">Copy response</TooltipContent>
                </Tooltip>
              </span>
            )}
          </div>
        )}
      </div>

      <PlaygroundPanels tab={tab} />

      {tab === 'response' && !response && !isFetching && (
        <div className="pointer-events-none absolute inset-x-0 top-12 bottom-0">
          <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-4 py-16 text-center">
            <span aria-hidden="true" className="flex shrink-0 text-disabled">
              <Braces strokeWidth={1} className="h-12 w-12" />
            </span>
            <div className="flex w-full flex-col gap-1 sm:max-w-md">
              <h3 className="font-semibold text-foreground text-lg">
                No response yet
              </h3>
              <div className="text-muted-foreground text-sm">
                Run a query to see the response.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Phones only: one pane at a time, so Query joins Response, History and Docs
// as a tab, with Run always in reach at the end.
function MobilePlaygroundBar() {
  const executionContext = useExecutionContext({ nonNull: true });
  const [tab, setTab] = usePlaygroundPanelTab();
  const { showQuery, setShowQuery } = useMobileQueryView();

  // No History count here: a phone has no room for it.
  function showPanel(next: PlaygroundPanelTab) {
    setTab(next);
    setShowQuery(false);
  }

  return (
    <div className="flex h-12 shrink-0 items-stretch justify-between gap-3 border-b px-4 md:hidden">
      <div role="tablist" className="flex min-w-0 items-stretch gap-5">
        <PanelTabButton active={showQuery} onClick={() => setShowQuery(true)}>
          Query
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'response'}
          onClick={() => showPanel('response')}
        >
          Response
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'history'}
          onClick={() => showPanel('history')}
        >
          History
        </PanelTabButton>
        <PanelTabButton
          active={!showQuery && tab === 'docs'}
          onClick={() => showPanel('docs')}
        >
          Docs
        </PanelTabButton>
      </div>

      <Button
        size="xs"
        onClick={() => {
          if (executionContext.isFetching) {
            executionContext.stop();
          }

          executionContext.run();
        }}
        aria-label="Execute GraphQL query"
        className="gap-1.5 self-center px-2.5"
      >
        <PlayIcon className="h-3.5 w-3.5" />
        Run
      </Button>
    </div>
  );
}

interface GraphiQLEditorProps {
  /**
   * Function to be called when the user changes the headers.
   */
  onHeaderChange: (headers: Record<string, unknown>) => void;
  /**
   * The request as the playground sends it, for the copy menu.
   */
  request: PlaygroundRequest;
}

function GraphiQLEditor({ onHeaderChange, request }: GraphiQLEditorProps) {
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
    <>
      <GraphiQLInterface
        defaultEditorToolsVisibility="variables"
        onEditHeaders={handleUserHeaderChange}
        disableTabs
      >
        <GraphiQL.Footer>
          <ResponsePaneExtras />
        </GraphiQL.Footer>
      </GraphiQLInterface>

      <GraphiQLSessionTabs />

      <QueryPaneHeader request={request} />
    </>
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
      // Kept outside React state: a new fetcher makes GraphiQL fetch the
      // schema again, so a run must not re-render this component.
      const [responseStatusStore] = useState(createResponseStatusStore);
      // Tabs, history and starred queries are kept per project, without
      // request headers.
      const projectId = project?.id;
      const storage = useMemo(
        () => (projectId ? createPlaygroundStorage(projectId) : undefined),
        [projectId],
      );

      useEffect(() => {
        removeSharedPlaygroundStorage();
      }, []);

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
      const responseMeter = createResponseMeter();
      const baseFetcher = createGraphiQLFetcher({
        url: appUrl,
        // Same request and Response as the default fetch; it only records the
        // status and size of measured runs for the Response status pill.
        fetch: responseMeter.fetch,
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
        if (graphQLParams.operationName === 'IntrospectionQuery') {
          return requestFetcher(graphQLParams, fetcherOpts);
        }

        const result = responseMeter.measure(
          () => requestFetcher(graphQLParams, fetcherOpts),
          responseStatusStore.startRun(),
        );

        if (result instanceof Promise) {
          result
            .then((payload) => trackGraphQLResponse(track, payload))
            .catch(() =>
              track('GraphQL Query Run', { outcome: 'request_error' }),
            );
        }

        return result;
      };

      return (
        <ResponseStatusContext.Provider value={responseStatusStore}>
          <GraphiQLProvider
            key={projectId}
            fetcher={fetcher}
            storage={storage}
            plugins={[HISTORY_PANEL_PLUGIN, DOCS_PANEL_PLUGIN]}
          >
            <MobileQueryViewProvider>
              <GraphiQLHeader onSelectionChange={handleSelectionChange} />

              <MobilePlaygroundBar />

              <GraphiQLEditor
                onHeaderChange={setHeadersTabOverrides}
                request={{
                  endpoint: appUrl,
                  adminSecret,
                  selection,
                  headersTabOverrides,
                }}
              />
            </MobileQueryViewProvider>
          </GraphiQLProvider>
        </ResponseStatusContext.Provider>
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
    <AppLayout>
      <ProjectScope>
        <GraphQLArea>
          <div className="graphiql-themed flex h-full flex-col">{page}</div>
        </GraphQLArea>
      </ProjectScope>
    </AppLayout>
  );
};
