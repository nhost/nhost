import {
  HeaderEditor,
  pick,
  QueryEditor,
  Spinner,
  tryParseJSONC,
  useDragResize,
  useGraphiQL,
  useGraphiQLActions,
  useMonaco,
  VariableEditor,
} from '@graphiql/react';
import { getSelectedOperationName } from '@graphiql/toolkit';
import { ChevronDown, Copy, WandSparkles } from 'lucide-react';
import { useState } from 'react';
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
import { PLAYGROUND_ICON_BUTTON_CLASSES as ICON_BUTTON_CLASSES } from '@/features/orgs/projects/graphql/common/constants/playground';
import {
  buildCurlSnippet,
  buildFetchSnippet,
  getHeaderEnvName,
} from '@/features/orgs/projects/graphql/common/utils/buildRequestSnippet';
import { composeRequestHeaders } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { cn } from '@/lib/utils';
import { copy } from '@/utils/copy';
import { triggerToast } from '@/utils/toast';
import DividerGrip from './DividerGrip';
import PanelTabButton from './PanelTabButton';
import RunButton from './RunButton';
import type { PlaygroundRequest } from './types';

// The query editor starts three times as tall as Variables and Headers.
const TOOLS_SIZE_RELATION = 3;
const TOOLS_STORAGE_KEY = 'secondaryEditorFlex';

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

interface QueryPaneHeaderProps {
  request: PlaygroundRequest;
  onRun: VoidFunction;
}

function QueryPaneHeader({ request, onRun }: QueryPaneHeaderProps) {
  const { copyQuery, prettifyEditors } = useGraphiQLActions();
  const { queryEditor, variableEditor, operationName, operations } =
    useGraphiQL(
      pick('queryEditor', 'variableEditor', 'operationName', 'operations'),
    );

  async function copyQueryText() {
    await copyQuery();
    triggerToast('Query copied to clipboard');
  }

  function copyRequest(
    build: typeof buildCurlSnippet,
    format: 'cURL' | 'fetch',
  ) {
    let variables: Record<string, unknown> = {};

    try {
      variables = tryParseJSONC(variableEditor?.getValue()) ?? {};
    } catch {
      triggerToast('Variables are not valid JSON');
      return;
    }

    const headers = getRequestHeaders(request);

    copy(
      build({
        endpoint: request.endpoint,
        headers,
        query: queryEditor?.getValue() ?? '',
        variables,
        // The operation Run would send: the one at the cursor.
        operationName: getSelectedOperationName(
          undefined,
          operationName,
          operations,
        ),
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

  return (
    // Phones use the bar above the panes instead: its Query tab and Run.
    // Prettify and the copy menu are desktop extras.
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
              onClick={copyQueryText}
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
              onSelect={copyQueryText}
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

        <RunButton className="ml-3" onRun={onRun} />
      </div>
    </div>
  );
}

interface QueryPaneProps {
  request: PlaygroundRequest;
  /** Called with the Headers tab's text on every edit. */
  onEditHeaders: (headers: string) => void;
  /** Called after a Ctrl+click on a field opened its docs. */
  onOpenDocs: () => void;
  /** Called when Run is pressed, before the run starts. */
  onRun: VoidFunction;
}

/** The query editor, with Variables and Headers under it. */
export default function QueryPane({
  request,
  onEditHeaders,
  onOpenDocs,
  onRun,
}: QueryPaneProps) {
  const hasMonaco = useMonaco((state) => Boolean(state.monaco));
  const [toolsTab, setToolsTab] = useState<'variables' | 'headers'>(
    'variables',
  );
  const storage = useGraphiQL((state) => state.storage);
  const tools = useDragResize({
    defaultSizeRelation: TOOLS_SIZE_RELATION,
    direction: 'vertical',
    sizeThresholdSecond: 60,
    storageKey: TOOLS_STORAGE_KEY,
  });

  // Dragging the bar to an edge hides a half and saves that. Picking a tab
  // brings both back at the default size and saves it, like a double click on
  // the bar, so a reload doesn't hide them again.
  function showToolsTab(nextTab: 'variables' | 'headers') {
    setToolsTab(nextTab);

    if (tools.hiddenElement === null) {
      return;
    }

    storage.set(TOOLS_STORAGE_KEY, `${TOOLS_SIZE_RELATION}`);
    tools.setHiddenElement(null);
  }

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border">
      <QueryPaneHeader request={request} onRun={onRun} />

      <div className="flex min-h-0 flex-1 flex-col">
        <section
          ref={tools.firstRef}
          aria-label="Query editor"
          className="min-h-0"
        >
          {hasMonaco ? (
            <QueryEditor onClickReference={onOpenDocs} />
          ) : (
            <Spinner />
          )}
        </section>

        {/* The bar is also the drag handle; its tabs stay plain clicks. */}
        <div
          ref={tools.dragBarRef}
          role="tablist"
          className="playground-divider playground-divider-y flex h-10 shrink-0 cursor-row-resize items-stretch gap-6 border-t bg-muted/50 px-4"
        >
          <DividerGrip />
          <PanelTabButton
            active={toolsTab === 'variables'}
            onClick={() => showToolsTab('variables')}
          >
            Variables
          </PanelTabButton>
          <PanelTabButton
            active={toolsTab === 'headers'}
            onClick={() => showToolsTab('headers')}
          >
            Headers
          </PanelTabButton>
        </div>

        {/* Both stay mounted, so switching keeps the cursor and undo history. */}
        <section
          ref={tools.secondRef}
          aria-label="Variables and headers"
          className="min-h-0 bg-muted/50"
        >
          <VariableEditor
            className={cn(toolsTab !== 'variables' && 'hidden')}
          />
          <HeaderEditor
            className={cn(toolsTab !== 'headers' && 'hidden')}
            onEdit={onEditHeaders}
          />
        </section>
      </div>
    </div>
  );
}
