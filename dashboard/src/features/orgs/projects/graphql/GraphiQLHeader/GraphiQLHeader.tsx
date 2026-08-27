import {
  DOC_EXPLORER_PLUGIN,
  useCopyQuery,
  useExecutionContext,
  usePluginContext,
  usePrettifyEditors,
  useTheme,
} from '@graphiql/react';
import { PlayIcon } from 'lucide-react';
import { useEffect } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { UserAndRoleSelect } from '@/features/orgs/projects/graphql/common/components/UserAndRoleSelect';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { isNotEmptyValue } from '@/lib/utils';
import { triggerToast } from '@/utils/toast';

interface GraphiQLHeaderProps {
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
}

export default function GraphiQLHeader({
  onSelectionChange,
}: GraphiQLHeaderProps) {
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
