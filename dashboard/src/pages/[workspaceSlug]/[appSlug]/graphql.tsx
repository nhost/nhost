import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Button } from '@/components/ui/v2/Button';
import { PlayIcon } from '@/components/ui/v2/icons/PlayIcon';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { UserSelect } from '@/features/graphql/common/components/UserSelect';
import { DEFAULT_ROLES } from '@/features/graphql/common/utils/constants';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { generateAppServiceUrl } from '@/features/projects/common/utils/generateAppServiceUrl';
import { triggerToast } from '@/utils/toast';
import {
  DOC_EXPLORER_PLUGIN,
  GraphiQLProvider,
  useCopyQuery,
  useExecutionContext,
  usePluginContext,
  usePrettifyEditors,
  useTheme,
} from '@graphiql/react';
import '@graphiql/react/dist/style.css';
import { createGraphiQLFetcher } from '@graphiql/toolkit';
import { GraphiQLInterface } from 'graphiql';
import 'graphiql/graphiql.min.css';
import { createClient } from 'graphql-ws';
import debounce from 'lodash.debounce';
import type { ReactElement } from 'react';
import { useEffect, useMemo, useState } from 'react';

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
  const [availableRoles, setAvailableRoles] = useState<string[]>(DEFAULT_ROLES);
  const [role, setRole] = useState<string>(() =>
    availableRoles.includes('user') ? 'user' : availableRoles[0],
  );

  const copyQuery = useCopyQuery();
  const prettifyEditors = usePrettifyEditors();
  const {
    isFetching: isQueryFetching,
    run: runQuery,
    stop: stopQuery,
  } = useExecutionContext();
  const { theme, setTheme } = useTheme();
  const { visiblePlugin, setVisiblePlugin } = usePluginContext();

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
        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
          <UserSelect
            className="col-span-1 md:col-auto md:w-52"
            onUserChange={(userId, availableUserRoles) => {
              onUserChange(userId);
              setAvailableRoles(availableUserRoles);

              const newRole = availableUserRoles.includes('user')
                ? 'user'
                : availableUserRoles[0];

              setRole(newRole);
              onRoleChange(newRole);
            }}
          />

          <Select
            id="role-select"
            label="Role"
            value={role}
            onChange={(_event, value) => {
              if (typeof value === 'string') {
                setRole(value);
                onRoleChange(value);
              }
            }}
            hideEmptyHelperText
            className="col-span-1 md:col-auto md:w-52"
          >
            {availableRoles.map((availableRole) => (
              <Option value={availableRole} key={availableRole}>
                {availableRole}
              </Option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
          <Tooltip title="Prettify query (Shift+Ctrl+P)">
            <Button
              variant="borderless"
              color="secondary"
              className="col-span-1 py-2 md:col-auto"
              onClick={prettifyEditors}
            >
              Prettify
            </Button>
          </Tooltip>

          <Tooltip title="Copy query (Shift+Ctrl+C)">
            <Button
              variant="borderless"
              color="secondary"
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
          variant="borderless"
          color="secondary"
          onClick={toggleDocumentationExplorer}
          className="col-span-1 md:col-auto"
        >
          Docs
        </Button>

        <Tooltip title="Execute query (Ctrl+Enter)" placement="bottom-end">
          <Button
            onClick={executeQuery}
            aria-label="Execute GraphQL query"
            startIcon={<PlayIcon />}
            className="col-span-1 py-2 md:col-auto"
          >
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

export default function GraphQLPage() {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [userHeaders, setUserHeaders] = useState<Record<string, any>>({});

  if (
    !currentProject?.subdomain ||
    !currentProject?.config?.hasura.adminSecret
  ) {
    return <LoadingScreen />;
  }

  const appUrl = generateAppServiceUrl(
    currentProject.subdomain,
    currentProject.region,
    'graphql',
  );

  const subscriptionUrl = `${appUrl
    .replace('https', 'wss')
    .replace('http', 'ws')}`;

  const headers = {
    'content-type': 'application/json',
    'x-hasura-admin-secret': currentProject.config?.hasura.adminSecret,
    ...userHeaders,
  };

  const fetcher = createGraphiQLFetcher({
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
    <RetryableErrorBoundary>
      <GraphiQLProvider fetcher={fetcher} shouldPersistHeaders>
        <GraphiQLHeader
          onUserChange={handleUserChange}
          onRoleChange={handleRoleChange}
        />

        <GraphiQLEditor onHeaderChange={setUserHeaders} />
      </GraphiQLProvider>
    </RetryableErrorBoundary>
  );
}

GraphQLPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
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
    </ProjectLayout>
  );
};
